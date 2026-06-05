from django.contrib import admin

from .models import PendingElevatedUser, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'is_staff', 'is_superuser', 'is_active', 'date_joined')
    list_filter = ('is_staff', 'is_superuser', 'is_active')
    search_fields = ('email',)
    ordering = ('email',)
    readonly_fields = ('date_joined', 'last_login')


@admin.register(PendingElevatedUser)
class PendingElevatedUserAdmin(admin.ModelAdmin):
    list_display = ('email', 'is_staff', 'is_superuser', 'requested_by', 'expires_at', 'consumed_at')
    list_filter = ('is_staff', 'is_superuser', 'consumed_at')
    search_fields = ('email', 'requested_by__email')
    readonly_fields = ('password_hash', 'token_hash', 'created_at', 'consumed_at')
