from django.urls import path
from . import views

from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('', views.Home), # http://localhost:8002
    path('api/token/', views.EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/me/', views.MeView.as_view(), name='me'),
    path('api/admin/users/', views.AdminUserListView.as_view(), name='admin_user_list'),
    path('api/admin/users/<int:pk>/', views.AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('api/admin/users/normal/', views.NormalUserCreateView.as_view(), name='admin_user_create_normal'),
    path('api/admin/users/elevated/', views.ElevatedUserRequestView.as_view(), name='admin_user_request_elevated'),
    path('api/admin/users/elevated/confirm/', views.ElevatedUserConfirmView.as_view(), name='admin_user_confirm_elevated'),
]
