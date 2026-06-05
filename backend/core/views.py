from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework import status
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import IsStaffUser, IsSuperUser
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


@api_view(['GET'])
def Home(request):
    return Response({"message": "Hello world"})


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSummarySerializer(request.user).data)


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
