from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

REGISTRATION_CHOICES = [
    ('email', 'Email'),
]

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)
    
class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True, help_text="The user's unique email address")

    registration_method = models.CharField(max_length=20, choices=REGISTRATION_CHOICES, default='email')

    is_superuser = models.BooleanField(default=False, help_text="Designates that this user has all permissions without explicitly assigning them.")
    is_active = models.BooleanField(default=True, help_text="Designates whether this user should be treated as active. Unselect this instead of deleting accounts.")
    is_staff = models.BooleanField(default=False, help_text="Designates whether the user can log into the admin site.")
    date_joined = models.DateTimeField(auto_now_add=True, help_text="The date and time when the user account was created.")

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class PendingElevatedUser(models.Model):
    email = models.EmailField()
    password_hash = models.CharField(max_length=128)
    is_staff = models.BooleanField(default=True)
    is_superuser = models.BooleanField(default=False)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='elevated_user_requests',
    )
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        role = 'superuser' if self.is_superuser else 'staff'
        return f'{self.email} ({role})'

    @classmethod
    def default_expiry(cls):
        return timezone.now() + timedelta(minutes=settings.ELEVATED_USER_APPROVAL_MINUTES)

    @property
    def is_consumed(self):
        return self.consumed_at is not None

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at
