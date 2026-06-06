import hashlib

from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework import status
from django.conf import settings
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import IsStaffUser, IsSuperUser
from .mailbox import (
    MailboxConfigurationError,
    MailboxConnectionError,
    get_mailbox_message,
    get_mailbox_page,
    get_mailbox_status,
)
from .serializers import (
    ElevatedUserConfirmSerializer,
    ElevatedUserRequestSerializer,
    EmailTokenObtainPairSerializer,
    NormalUserCreateSerializer,
    UserAdminSerializer,
    UserAdminUpdateSerializer,
    UserSummarySerializer,
)

User = get_user_model()


def _mail_cache_key(kind, alias, value):
    alias_hash = hashlib.sha256(alias.lower().encode('utf-8')).hexdigest()
    return f'mail:v2:{kind}:{alias_hash}:{value}'


@api_view(['GET'])
def Home(request):
    return Response({"message": "Hello world"})


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSummarySerializer(request.user).data)


class MailListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            page = max(int(request.query_params.get('page', 1)), 1)
        except (TypeError, ValueError):
            page = 1

        page_size = min(max(settings.MAIL_PAGE_SIZE, 1), 100)
        cache_key = _mail_cache_key('list', request.user.email, page)
        force_refresh = request.query_params.get('refresh') == '1'
        mailbox = None if force_refresh else cache.get(cache_key)

        try:
            if mailbox is None:
                mailbox = get_mailbox_page(
                    alias=request.user.email,
                    page=page,
                    page_size=page_size,
                )
                cache.set(cache_key, mailbox, settings.MAIL_LIST_CACHE_SECONDS)
        except (MailboxConfigurationError, MailboxConnectionError) as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({
            'messages': mailbox.messages,
            'total': mailbox.total,
            'page': mailbox.page,
            'page_size': mailbox.page_size,
            'has_more': mailbox.has_more,
            'latest_uid': mailbox.latest_uid,
            'poll_seconds': max(settings.MAIL_POLL_SECONDS, 10),
        })


class MailStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            mailbox_status = get_mailbox_status(request.user.email)
        except (MailboxConfigurationError, MailboxConnectionError) as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(mailbox_status)


class MailDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, uid):
        cache_key = _mail_cache_key('message', request.user.email, uid)
        message = cache.get(cache_key)

        try:
            if message is None:
                message = get_mailbox_message(request.user.email, uid)
                if message is not None:
                    cache.set(
                        cache_key,
                        message,
                        settings.MAIL_MESSAGE_CACHE_SECONDS,
                    )
        except (MailboxConfigurationError, MailboxConnectionError) as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if message is None:
            return Response(
                {'detail': 'Message not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(message)


class NormalUserCreateView(CreateAPIView):
    permission_classes = [IsStaffUser]
    serializer_class = NormalUserCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSummarySerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserListView(APIView):
    permission_classes = [IsStaffUser]

    def get_queryset(self):
        queryset = User.objects.order_by('-is_superuser', '-is_staff', 'email')
        if self.request.user.is_superuser:
            return queryset

        return queryset.filter(is_staff=False, is_superuser=False)

    def get(self, request):
        serializer = UserAdminSerializer(self.get_queryset(), many=True)
        return Response(serializer.data)


class AdminUserDetailView(APIView):
    permission_classes = [IsSuperUser]

    def get_object(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        if user.pk == request.user.pk:
            raise PermissionDenied('You cannot modify your own account from this screen.')
        return user

    def patch(self, request, pk):
        user = self.get_object(request, pk)
        serializer = UserAdminUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()
        return Response(UserAdminSerializer(updated_user).data)

    def delete(self, request, pk):
        user = self.get_object(request, pk)
        if user.is_superuser:
            other_active_superuser_exists = User.objects.filter(
                is_superuser=True,
                is_active=True,
            ).exclude(pk=user.pk).exists()
            if not other_active_superuser_exists:
                raise ValidationError('Cannot delete the last active superuser.')

        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ElevatedUserRequestView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request):
        serializer = ElevatedUserRequestSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        pending = serializer.save()
        return Response(
            {
                'approval_required': True,
                'email': pending.email,
                'is_staff': pending.is_staff,
                'is_superuser': pending.is_superuser,
                'expires_at': pending.expires_at,
                'sent_to': serializer.approval_recipient,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class ElevatedUserConfirmView(APIView):
    permission_classes = [IsSuperUser]

    def post(self, request):
        serializer = ElevatedUserConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSummarySerializer(user).data, status=status.HTTP_201_CREATED)
