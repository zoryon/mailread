from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .mailbox import MailboxConnectionError, MailboxPage
from .models import PendingElevatedUser


User = get_user_model()


PASSWORD = 'A-safe-passphrase-2026!'


class MailApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('alias@zoryo.uk', PASSWORD)

    @patch('core.views.get_mailbox_page')
    def test_mail_list_uses_authenticated_user_email_as_alias(self, get_mailbox_page):
        get_mailbox_page.return_value = MailboxPage(
            messages=[
                {
                    'id': '123',
                    'from': 'Sender <sender@example.com>',
                    'to': self.user.email,
                    'subject': 'Test message',
                    'date': '2026-06-06T10:00:00+00:00',
                    'preview': 'Message preview',
                    'body': 'Message preview',
                    'unread': True,
                    'truncated': False,
                }
            ],
            total=1,
            page=1,
            page_size=50,
            latest_uid='123',
        )
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/mail/?page=1&alias=someone-else@example.com')
        cached_response = self.client.get('/api/mail/?page=1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(cached_response.status_code, 200)
        self.assertEqual(response.data['messages'][0]['subject'], 'Test message')
        self.assertFalse(response.data['has_more'])
        get_mailbox_page.assert_called_once_with(
            alias=self.user.email,
            page=1,
            page_size=50,
        )

        refreshed_response = self.client.get('/api/mail/?page=1&refresh=1')

        self.assertEqual(refreshed_response.status_code, 200)
        self.assertEqual(get_mailbox_page.call_count, 2)

    @patch('core.views.get_mailbox_status')
    def test_mail_status_checks_the_authenticated_alias(self, get_status):
        get_status.return_value = {'total': 2, 'latest_uid': '456'}
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/mail/status/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['latest_uid'], '456')
        get_status.assert_called_once_with(self.user.email)

    def test_mail_list_requires_authentication(self):
        response = self.client.get('/api/mail/')

        self.assertEqual(response.status_code, 401)

    @patch('core.views.get_mailbox_page')
    def test_mailbox_connection_errors_return_service_unavailable(self, get_mailbox_page):
        get_mailbox_page.side_effect = MailboxConnectionError('Gmail unavailable.')
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/mail/')

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['detail'], 'Gmail unavailable.')

    @patch('core.views.get_mailbox_message')
    def test_mail_detail_is_scoped_to_authenticated_alias_and_cached(self, get_message):
        get_message.return_value = {
            'id': '123',
            'from': 'sender@example.com',
            'to': self.user.email,
            'subject': 'Cached message',
            'date': None,
            'preview': 'Preview',
            'body': 'Full body',
            'unread': False,
            'truncated': False,
        }
        self.client.force_authenticate(user=self.user)

        first_response = self.client.get('/api/mail/123/')
        second_response = self.client.get('/api/mail/123/')

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(second_response.data['body'], 'Full body')
        get_message.assert_called_once_with(self.user.email, '123')


class AdminUserApiTests(APITestCase):
    def setUp(self):
        self.normal_user = User.objects.create_user('normal@example.com', PASSWORD)
        self.staff_user = User.objects.create_user('staff@example.com', PASSWORD, is_staff=True)
        self.super_user = User.objects.create_superuser('root@example.com', PASSWORD)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_login_returns_user_claims(self):
        response = self.client.post(
            '/api/token/',
            {'email': self.normal_user.email, 'password': PASSWORD},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['email'], self.normal_user.email)
        self.assertFalse(response.data['user']['is_staff'])

    def test_normal_user_cannot_create_users(self):
        self.authenticate(self.normal_user)

        response = self.client.post(
            '/api/admin/users/normal/',
            {'email': 'new@example.com', 'password': PASSWORD},
            format='json',
        )

        self.assertEqual(response.status_code, 403)

    def test_staff_can_create_normal_users(self):
        self.authenticate(self.staff_user)

        response = self.client.post(
            '/api/admin/users/normal/',
            {'email': 'new@example.com', 'password': PASSWORD},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        created = User.objects.get(email='new@example.com')
        self.assertFalse(created.is_staff)
        self.assertFalse(created.is_superuser)

    def test_normal_user_cannot_list_admin_users(self):
        self.authenticate(self.normal_user)

        response = self.client.get('/api/admin/users/')

        self.assertEqual(response.status_code, 403)

    def test_staff_lists_only_normal_users(self):
        User.objects.create_user('another-normal@example.com', PASSWORD)
        self.authenticate(self.staff_user)

        response = self.client.get('/api/admin/users/')

        self.assertEqual(response.status_code, 200)
        emails = {user['email'] for user in response.data}
        self.assertIn('normal@example.com', emails)
        self.assertIn('another-normal@example.com', emails)
        self.assertNotIn('staff@example.com', emails)
        self.assertNotIn('root@example.com', emails)

    def test_superuser_lists_all_user_roles(self):
        self.authenticate(self.super_user)

        response = self.client.get('/api/admin/users/')

        self.assertEqual(response.status_code, 200)
        users_by_email = {user['email']: user for user in response.data}
        self.assertEqual(users_by_email['normal@example.com']['role'], 'normal')
        self.assertEqual(users_by_email['staff@example.com']['role'], 'staff')
        self.assertEqual(users_by_email['root@example.com']['role'], 'superuser')

    def test_staff_cannot_update_or_delete_users(self):
        self.authenticate(self.staff_user)

        patch_response = self.client.patch(
            f'/api/admin/users/{self.normal_user.pk}/',
            {'email': 'changed@example.com'},
            format='json',
        )
        delete_response = self.client.delete(f'/api/admin/users/{self.normal_user.pk}/')

        self.assertEqual(patch_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        self.normal_user.refresh_from_db()
        self.assertEqual(self.normal_user.email, 'normal@example.com')

    def test_superuser_updates_another_user(self):
        self.authenticate(self.super_user)

        response = self.client.patch(
            f'/api/admin/users/{self.staff_user.pk}/',
            {
                'email': 'renamed-staff@example.com',
                'is_staff': True,
                'is_superuser': False,
                'is_active': False,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.staff_user.refresh_from_db()
        self.assertEqual(self.staff_user.email, 'renamed-staff@example.com')
        self.assertFalse(self.staff_user.is_active)

    def test_superuser_deletes_another_user(self):
        self.authenticate(self.super_user)

        response = self.client.delete(f'/api/admin/users/{self.normal_user.pk}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.normal_user.pk).exists())

    def test_superuser_cannot_modify_or_delete_self(self):
        self.authenticate(self.super_user)

        patch_response = self.client.patch(
            f'/api/admin/users/{self.super_user.pk}/',
            {'email': 'self-change@example.com'},
            format='json',
        )
        delete_response = self.client.delete(f'/api/admin/users/{self.super_user.pk}/')

        self.assertEqual(patch_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        self.super_user.refresh_from_db()
        self.assertEqual(self.super_user.email, 'root@example.com')

    def test_staff_cannot_request_elevated_users(self):
        self.authenticate(self.staff_user)

        response = self.client.post(
            '/api/admin/users/elevated/',
            {
                'email': 'elevated@example.com',
                'password': PASSWORD,
                'is_staff': True,
                'is_superuser': False,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 403)

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.smtp.EmailBackend',
        EMAIL_HOST='',
        EMAIL_HOST_USER='',
        EMAIL_HOST_PASSWORD='',
    )
    def test_incomplete_smtp_settings_do_not_create_pending_request(self):
        self.authenticate(self.super_user)

        response = self.client.post(
            '/api/admin/users/elevated/',
            {
                'email': 'smtp-missing@example.com',
                'password': PASSWORD,
                'is_staff': True,
                'is_superuser': False,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(PendingElevatedUser.objects.filter(email='smtp-missing@example.com').count(), 0)

    @override_settings(
        EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        FRONTEND_URL='http://localhost:3000',
        ADMIN_APPROVAL_EMAIL='owner@example.com',
    )
    def test_superuser_requests_and_confirms_elevated_user(self):
        self.authenticate(self.super_user)

        request_response = self.client.post(
            '/api/admin/users/elevated/',
            {
                'email': 'elevated@example.com',
                'password': PASSWORD,
                'is_staff': True,
                'is_superuser': True,
            },
            format='json',
        )

        self.assertEqual(request_response.status_code, 202)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(request_response.data['sent_to'], 'owner@example.com')

        pending = PendingElevatedUser.objects.get(email='elevated@example.com')
        token = mail.outbox[0].body.split('/dashboard/users/approve/')[1].split()[0]

        confirm_response = self.client.post(
            '/api/admin/users/elevated/confirm/',
            {'token': token},
            format='json',
        )

        self.assertEqual(confirm_response.status_code, 201)
        created = User.objects.get(email='elevated@example.com')
        pending.refresh_from_db()
        self.assertTrue(created.is_staff)
        self.assertTrue(created.is_superuser)
        self.assertIsNotNone(pending.consumed_at)
