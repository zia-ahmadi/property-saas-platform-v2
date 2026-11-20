package com.propertysaas.propertycore.dashboard;

import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/dashboard")
public class DashboardController {
    private final AuthenticatedOrganizationContextResolver contextResolver;
    private final CurrentUserAuthorizationService authorization;
    private final DashboardSummaryRepository repository;

    public DashboardController(AuthenticatedOrganizationContextResolver contextResolver,
                               CurrentUserAuthorizationService authorization,
                               DashboardSummaryRepository repository) {
        this.contextResolver = contextResolver;
        this.authorization = authorization;
        this.repository = repository;
    }

    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public DashboardSummary summary(@PathVariable UUID organizationId) {
        contextResolver.resolve(organizationId);
        authorization.requirePermission(organizationId, OrganizationPermission.PROPERTY_VIEW);
        return repository.summarize(organizationId);
    }
}
