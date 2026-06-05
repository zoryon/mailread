import hashlib
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import PendingElevatedUser


User = get_user_model()


def smtp_settings_missing():
    if not settings.EMAIL_BACKEND.endswith('smtp.EmailBackend'):
        return []

    required_settings = {
        'EMAIL_HOST': settings.EMAIL_HOST,
        'EMAIL_HOST_USER': settings.EMAIL_HOST_USER,
        'EMAIL_HOST_PASSWORD': settings.EMAIL_HOST_PASSWORD,
    }
    return [name for name, value in required_settings.items() if not value]


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'is_staff', 'is_superuser']


class UserAdminSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'is_staff', 'is_superuser', 'is_active', 'date_joined', 'last_login', 'role']

    def get_role(self, user):
        if user.is_superuser:
            return 'superuser'
        if user.is_staff:
            return 'staff'
        return 'normal'


class UserAdminUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        required=False,
        allow_blank=False,
        min_length=8,
    )

    class Meta:
        model = User
        fields = ['email', 'password', 'is_staff', 'is_superuser', 'is_active']
        extra_kwargs = {
            'email': {'required': False},
            'is_staff': {'required': False},
            'is_superuser': {'required': False},
            'is_active': {'required': False},
        }

    def validate_email(self, value):
        email = User.objects.normalize_email(value)
        existing = User.objects.filter(email=email)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate_password(self, value):
        try:
            validate_password(value, user=self.instance)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        final_is_superuser = attrs.get('is_superuser', self.instance.is_superuser)
        final_is_staff = attrs.get('is_staff', self.instance.is_staff)
        final_is_active = attrs.get('is_active', self.instance.is_active)

        if final_is_superuser and not final_is_staff:
            attrs['is_staff'] = True

        if self.instance.is_superuser and (not final_is_superuser or not final_is_active):
            other_active_superuser_exists = User.objects.filter(
                is_superuser=True,
                is_active=True,
            ).exclude(pk=self.instance.pk).exists()
            if not other_active_superuser_exists:
                raise serializers.ValidationError(
                    'Cannot remove or deactivate the last active superuser.'
                )

        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSummarySerializer(self.user).data
        return data


class BaseUserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=8)

    def validate_email(self, value):
        email = User.objects.normalize_email(value)
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class NormalUserCreateSerializer(BaseUserCreateSerializer):
    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            is_staff=False,
            is_superuser=False,
        )


class ElevatedUserRequestSerializer(BaseUserCreateSerializer):
    is_staff = serializers.BooleanField(default=True)
    is_superuser = serializers.BooleanField(default=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get('is_superuser'):
            attrs['is_staff'] = True

        if not attrs.get('is_staff') and not attrs.get('is_superuser'):
            raise serializers.ValidationError('Use the normal user endpoint for non-admin accounts.')

        active_request_exists = PendingElevatedUser.objects.filter(
            email=attrs['email'],
            consumed_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).exists()
        if active_request_exists:
            raise serializers.ValidationError('A pending approval already exists for this email.')

        return attrs

    def create(self, validated_data):
        request = self.context['request']
        missing_settings = smtp_settings_missing()
        if missing_settings:
            raise serializers.ValidationError({
                'email': f'SMTP settings incomplete: {", ".join(missing_settings)}.'
            })

        raw_token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

        approval_recipient = settings.ADMIN_APPROVAL_EMAIL or request.user.email
        with transaction.atomic():
            pending = PendingElevatedUser.objects.create(
                email=validated_data['email'],
                password_hash=make_password(validated_data['password']),
                is_staff=validated_data['is_staff'],
                is_superuser=validated_data['is_superuser'],
                requested_by=request.user,
                token_hash=token_hash,
                expires_at=PendingElevatedUser.default_expiry(),
            )

            approval_url = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/users/approve/{raw_token}"
            role_label = 'superuser' if pending.is_superuser else 'staff'

            message = (
                f'Confirm creation of {role_label} account {pending.email}.\n\n'
                f'Approval link: {approval_url}\n\n'
                f'This request expires at {pending.expires_at:%Y-%m-%d %H:%M:%S %Z}.'
            )
            html_message = (
                '<p>Confirm creation of '
                f'<strong>{role_label}</strong> account <strong>{pending.email}</strong>.</p>'
                f'<p><a href="{approval_url}" '
                'style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;'
                'text-decoration:none;border-radius:6px">Confirm user creation</a></p>'
                f'<p>This request expires at {pending.expires_at:%Y-%m-%d %H:%M:%S %Z}.</p>'
            )

            try:
                send_mail(
                    subject=f'Confirm {role_label} user creation',
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[approval_recipient],
                    html_message=html_message,
                    fail_silently=False,
                )
            except Exception as exc:
                raise serializers.ValidationError({
                    'email': 'Approval email could not be sent. Check SMTP settings and credentials.'
                }) from exc

        self.approval_recipient = approval_recipient
        return pending


class ElevatedUserConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True, trim_whitespace=False)

    def create(self, validated_data):
        token_hash = hashlib.sha256(validated_data['token'].encode('utf-8')).hexdigest()

        with transaction.atomic():
            try:
                pending = PendingElevatedUser.objects.select_for_update().get(token_hash=token_hash)
            except PendingElevatedUser.DoesNotExist:
                raise serializers.ValidationError({'token': 'Invalid approval token.'})

            if pending.is_consumed:
                raise serializers.ValidationError({'token': 'This approval token has already been used.'})
            if pending.is_expired:
                raise serializers.ValidationError({'token': 'This approval token has expired.'})
            if User.objects.filter(email=pending.email).exists():
                raise serializers.ValidationError({'email': 'An account with this email already exists.'})

            user = User(
                email=pending.email,
                is_staff=pending.is_staff,
                is_superuser=pending.is_superuser,
                is_active=True,
            )
            user.password = pending.password_hash
            user.save()

            pending.consumed_at = timezone.now()
            pending.save(update_fields=['consumed_at'])

        return user
