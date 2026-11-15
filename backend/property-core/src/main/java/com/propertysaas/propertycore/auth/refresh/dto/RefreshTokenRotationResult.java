package com.propertysaas.propertycore.auth.refresh.dto;

import com.propertysaas.propertycore.user.entity.User;

public record RefreshTokenRotationResult(
        User user,
        String refreshToken
) {
}