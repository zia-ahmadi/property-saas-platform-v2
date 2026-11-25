package com.propertysaas.propertycore.notification;

import com.propertysaas.propertycore.config.security.authentication.AuthenticatedUserService;
import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static com.propertysaas.propertycore.organization.permission.OrganizationPermission.BILLING_MANAGE;
import static com.propertysaas.propertycore.organization.permission.OrganizationPermission.MAINTENANCE_MANAGE;

@RestController
@RequestMapping("/api/v1")
public class NotificationFeedController {
    private static final String EVENTS = "/organizations/{organizationId}/notification-events";
    private record Access(UUID user, boolean maintenance, boolean billing) {}

    private final AuthenticatedUserService currentUser;
    private final AuthenticatedOrganizationContextResolver context;
    private final CurrentUserAuthorizationService authorization;
    private final NotificationFeedRepository repository;

    NotificationFeedController(AuthenticatedUserService currentUser, AuthenticatedOrganizationContextResolver context,
                               CurrentUserAuthorizationService authorization, NotificationFeedRepository repository) {
        this.currentUser = currentUser;
        this.context = context;
        this.authorization = authorization;
        this.repository = repository;
    }

    @GetMapping(EVENTS)
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public List<NotificationFeedRepository.Event> read(@PathVariable UUID organizationId,
                                                        @RequestParam(required = false) Long after,
                                                        @RequestParam(defaultValue = "20") int limit) {
        if (limit < 1 || limit > 100 || (after != null && after < 0)) {
            throw new IllegalArgumentException("Use a nonnegative cursor and a limit from 1 to 100.");
        }
        Access access = authorize(organizationId);
        return repository.read(organizationId, access.user(), after, limit, access.maintenance(), access.billing());
    }

    @GetMapping(EVENTS + "/unread-count")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public long unreadCount(@PathVariable UUID organizationId) {
        Access access = authorize(organizationId);
        return repository.unreadCount(organizationId, access.user(), access.maintenance(), access.billing());
    }

    @PostMapping(EVENTS + "/{cursor}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void markRead(@PathVariable UUID organizationId, @PathVariable long cursor) {
        Access access = authorize(organizationId);
        if (!repository.markRead(organizationId, access.user(), cursor, access.maintenance(), access.billing())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found");
        }
    }

    @PostMapping(EVENTS + "/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void markAllRead(@PathVariable UUID organizationId) {
        Access access = authorize(organizationId);
        repository.markAllRead(organizationId, access.user(), access.maintenance(), access.billing());
    }

    @PostMapping("/my-support-notifications/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void markSupportRead() {
        repository.markSupportRead(currentUser.getCurrentUserId());
    }

    @GetMapping("/my-support-notifications")
    @Transactional(readOnly = true)
    public NotificationFeedRepository.SupportFeed support() {
        return repository.support(currentUser.getCurrentUserId());
    }

    private Access authorize(UUID organizationId) {
        context.resolve(organizationId);
        boolean maintenance = authorization.hasPermission(organizationId, MAINTENANCE_MANAGE);
        boolean billing = authorization.hasPermission(organizationId, BILLING_MANAGE);
        if (!maintenance && !billing) throw new AccessDeniedException("Notification access required");
        return new Access(currentUser.getCurrentUserId(), maintenance, billing);
    }
}
