import html
import imaplib
import re
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import timezone
from email import policy
from email.header import decode_header, make_header
from email.parser import BytesParser
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser

from django.conf import settings


class MailboxConfigurationError(Exception):
    pass


class MailboxConnectionError(Exception):
    pass


@dataclass
class MailboxPage:
    messages: list[dict]
    total: int
    page: int
    page_size: int
    latest_uid: str | None

    @property
    def has_more(self):
        return self.page * self.page_size < self.total


class _HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def text(self):
        return ' '.join(self.parts)


def _decode_header(value):
    if not value:
        return ''
    try:
        return str(make_header(decode_header(value)))
    except (LookupError, UnicodeDecodeError):
        return value


def _decode_part(part):
    payload = part.get_payload(decode=True)
    if payload is None:
        return ''

    charset = part.get_content_charset() or 'utf-8'
    try:
        return payload.decode(charset, errors='replace')
    except LookupError:
        return payload.decode('utf-8', errors='replace')


def _plain_text(message):
    html_body = ''

    for part in message.walk():
        if part.is_multipart():
            continue
        if part.get_content_disposition() == 'attachment':
            continue

        content_type = part.get_content_type()
        if content_type == 'text/plain':
            return _decode_part(part)
        if content_type == 'text/html' and not html_body:
            html_body = _decode_part(part)

    if not html_body:
        return ''

    parser = _HTMLTextExtractor()
    parser.feed(html_body)
    return html.unescape(parser.text())


def _clean_text(value):
    return re.sub(r'\s+', ' ', value).strip()


def _iso_date(value):
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


def _parse_message(uid, response, max_bytes, include_body=True):
    metadata = b''
    raw_message = None

    for item in response:
        if not isinstance(item, tuple):
            continue
        metadata += item[0] if isinstance(item[0], bytes) else b''
        if isinstance(item[1], bytes):
            raw_message = item[1]

    if raw_message is None:
        return None

    message = BytesParser(policy=policy.default).parsebytes(raw_message)
    body = _clean_text(_plain_text(message))
    flags = imaplib.ParseFlags(metadata)

    return {
        'id': uid,
        'from': _decode_header(message.get('From')),
        'to': _decode_header(message.get('To')),
        'subject': _decode_header(message.get('Subject')) or '(No subject)',
        'date': _iso_date(message.get('Date')),
        'preview': body[:240],
        'body': body if include_body else None,
        'unread': b'\\Seen' not in flags,
        'truncated': len(raw_message) >= max_bytes,
    }


def _connection_settings():
    host = settings.MAIL_IMAP_HOST
    username = settings.MAIL_IMAP_USER
    password = settings.MAIL_IMAP_PASSWORD

    missing = [
        name
        for name, value in {
            'MAIL_IMAP_HOST': host,
            'MAIL_IMAP_USER': username,
            'MAIL_IMAP_PASSWORD': password,
        }.items()
        if not value
    ]
    if missing:
        raise MailboxConfigurationError(
            f'Mailbox settings incomplete: {", ".join(missing)}.'
        )

    return host, username, password


@contextmanager
def _open_mailbox():
    host, username, password = _connection_settings()
    client = None

    try:
        if settings.MAIL_IMAP_USE_SSL:
            client = imaplib.IMAP4_SSL(
                host,
                settings.MAIL_IMAP_PORT,
                timeout=settings.MAIL_IMAP_TIMEOUT,
            )
        else:
            client = imaplib.IMAP4(
                host,
                settings.MAIL_IMAP_PORT,
                timeout=settings.MAIL_IMAP_TIMEOUT,
            )
            client.starttls()

        client.login(username, password)
        status, _ = client.select(settings.MAIL_IMAP_FOLDER, readonly=True)
        if status != 'OK':
            raise MailboxConnectionError('The configured mailbox folder is not available.')
        yield client
    except MailboxConfigurationError:
        raise
    except MailboxConnectionError:
        raise
    except (imaplib.IMAP4.error, OSError) as exc:
        raise MailboxConnectionError(
            'Could not connect to Gmail. Check the IMAP account and app password.'
        ) from exc
    finally:
        if client is not None:
            try:
                client.logout()
            except (imaplib.IMAP4.error, OSError):
                pass


def _search_alias_uids(client, alias):
    # X-GM-RAW uses Gmail's search syntax and deliveredto matches the actual
    # envelope recipient, which is the reliable discriminator for aliases.
    query = f'"deliveredto:{alias}"'
    status, search_data = client.uid('search', None, 'X-GM-RAW', query)
    if status != 'OK':
        raise MailboxConnectionError('Gmail could not search the mailbox.')
    return search_data[0].split() if search_data and search_data[0] else []


def get_mailbox_page(alias, page=1, page_size=50):
    with _open_mailbox() as client:
        uids = _search_alias_uids(client, alias)
        uids.reverse()
        total = len(uids)
        latest_uid = uids[0].decode() if uids else None
        start = (page - 1) * page_size
        selected_uids = uids[start:start + page_size]
        messages = []

        for raw_uid in selected_uids:
            uid = raw_uid.decode()
            fetch_fields = (
                f'(BODY.PEEK[]<0.{settings.MAIL_LIST_MESSAGE_BYTES}> '
                'FLAGS X-GM-MSGID)'
            )
            status, response = client.uid(
                'fetch',
                uid,
                fetch_fields,
            )
            if status != 'OK':
                continue
            parsed = _parse_message(
                uid,
                response,
                max_bytes=settings.MAIL_LIST_MESSAGE_BYTES,
                include_body=False,
            )
            if parsed:
                messages.append(parsed)

        return MailboxPage(
            messages=messages,
            total=total,
            page=page,
            page_size=page_size,
            latest_uid=latest_uid,
        )


def get_mailbox_status(alias):
    with _open_mailbox() as client:
        uids = _search_alias_uids(client, alias)
        return {
            'total': len(uids),
            'latest_uid': uids[-1].decode() if uids else None,
        }


def get_mailbox_message(alias, uid):
    if not uid.isdigit():
        return None

    with _open_mailbox() as client:
        allowed_uids = _search_alias_uids(client, alias)
        if uid.encode() not in allowed_uids:
            return None

        fetch_fields = (
            f'(BODY.PEEK[]<0.{settings.MAIL_MAX_MESSAGE_BYTES}> '
            'FLAGS X-GM-MSGID)'
        )
        status, response = client.uid('fetch', uid, fetch_fields)
        if status != 'OK':
            raise MailboxConnectionError('Gmail could not load the message.')

        return _parse_message(
            uid,
            response,
            max_bytes=settings.MAIL_MAX_MESSAGE_BYTES,
        )
