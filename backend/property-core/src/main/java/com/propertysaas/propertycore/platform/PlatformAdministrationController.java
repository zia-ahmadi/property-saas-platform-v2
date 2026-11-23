package com.propertysaas.propertycore.platform;

import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.config.security.authentication.AuthenticatedUserService;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class PlatformAdministrationController {
    private final JdbcTemplate db;
    private final AuthenticatedUserService currentUser;
    private final CurrentUserAuthorizationService authorization;
    public PlatformAdministrationController(JdbcTemplate db, AuthenticatedUserService currentUser, CurrentUserAuthorizationService authorization) {
        this.db = db; this.currentUser = currentUser; this.authorization = authorization;
    }
    private UUID requirePlatformOwner() {
        UUID id = currentUser.getCurrentUserId();
        Integer count = db.queryForObject("SELECT count(*) FROM platform_authorities a JOIN users u ON u.id = a.user_id WHERE a.user_id = ? AND a.authority = 'PLATFORM_OWNER' AND u.status = 'active'", Integer.class, id);
        if (count == null || count == 0) throw new AccessDeniedException("Platform owner required");
        return id;
    }
    public record OrganizationPage(List<Map<String, Object>> content, long total, int page, int size) { }
    public record Decision(@NotBlank String action, @Size(max = 2000) String reason) { }
    public record MessageInput(@NotBlank @Size(max = 5000) String body) { }
    @GetMapping("/my-organizations/status")
    public List<Map<String, Object>> myOrganizationStatuses() {
        UUID user = currentUser.getCurrentUserId();
        return db.queryForList("SELECT o.id, o.name, o.status, m.role FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id JOIN users u ON u.id=m.user_id WHERE m.user_id=? AND m.status='active' AND u.status='active' AND o.status <> 'active' ORDER BY o.name", user);
    }
    @GetMapping("/platform/me")
    public Map<String, Boolean> platformMe() { requirePlatformOwner(); return Map.of("platformOwner", true); }
    @GetMapping("/platform/organizations")
    public OrganizationPage organizations(@RequestParam(defaultValue = "") String search, @RequestParam(required = false) String status, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        requirePlatformOwner();
        if (page < 0 || size < 1 || size > 100 || page > 1000000) throw new IllegalArgumentException("Invalid pagination");
        String filter = status == null || status.isBlank() ? null : status.toLowerCase(Locale.ROOT);
        if (filter != null && !Set.of("pending", "active", "rejected", "suspended", "banned").contains(filter)) throw new IllegalArgumentException("Invalid status");
        String pattern = "%" + search.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        String where = " WHERE (lower(name) LIKE ? ESCAPE '\\' OR lower(slug) LIKE ? ESCAPE '\\') AND (CAST(? AS varchar) IS NULL OR status = ?)";
        Long total = db.queryForObject("SELECT count(*) FROM organizations" + where, Long.class, pattern, pattern, filter, filter);
        var rows = db.queryForList("SELECT id, name, slug, status, created_at, updated_at FROM organizations" + where + " ORDER BY created_at DESC, id LIMIT ? OFFSET ?", pattern, pattern, filter, filter, size, (long) page * size);
        return new OrganizationPage(rows, total == null ? 0 : total, page, size);
    }
    @GetMapping("/platform/organizations/{id}")
    public Map<String, Object> organization(@PathVariable UUID id) {
        requirePlatformOwner();
        var rows = db.queryForList("SELECT id, name, slug, status, created_at, updated_at FROM organizations WHERE id = ?", id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found");
        return rows.get(0);
    }
    @GetMapping("/platform/organizations/{id}/audit")
    public List<Map<String, Object>> audit(@PathVariable UUID id) {
        requirePlatformOwner();
        return db.queryForList("SELECT id, actor_user_id, previous_status, new_status, reason, created_at FROM organization_status_audit WHERE organization_id = ? ORDER BY created_at DESC, id", id);
    }
    @Transactional
    @PostMapping("/platform/organizations/{id}/decisions")
    public Map<String, String> decide(@PathVariable UUID id, @Valid @RequestBody Decision decision) {
        UUID actor = requirePlatformOwner();
        var statuses = db.queryForList("SELECT status FROM organizations WHERE id = ? FOR UPDATE", String.class, id);
        if (statuses.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found");
        String old = statuses.get(0), action = decision.action().trim().toLowerCase(Locale.ROOT);
        String next = switch (action) {
            case "approve" -> old.equals("pending") ? "active" : null;
            case "reject" -> old.equals("pending") ? "rejected" : null;
            case "suspend" -> old.equals("active") ? "suspended" : null;
            case "reinstate" -> old.equals("suspended") ? "active" : null;
            case "ban" -> Set.of("pending", "active", "suspended").contains(old) ? "banned" : null;
            default -> throw new IllegalArgumentException("Unknown decision");
        };
        if (next == null) throw new ConflictException("Decision is not valid for the current status");
        String reason = decision.reason() == null ? null : decision.reason().trim();
        if (Set.of("reject", "suspend", "ban").contains(action) && (reason == null || reason.isEmpty())) throw new IllegalArgumentException("A reason is required for this decision");
        db.update("UPDATE organizations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", next, id);
        db.update("INSERT INTO organization_status_audit (id, organization_id, actor_user_id, previous_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?)", UUID.randomUUID(), id, actor, old, next, reason);
        return Map.of("status", next);
    }
    @PostMapping("/platform/organizations/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> send(@PathVariable UUID id, @Valid @RequestBody MessageInput input) {
        UUID actor = requirePlatformOwner();
        if (Boolean.FALSE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM organizations WHERE id = ?)", Boolean.class, id))) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Organization not found");
        UUID messageId = UUID.randomUUID();
        db.update("INSERT INTO organization_messages (id, organization_id, sender_user_id, body) VALUES (?, ?, ?, ?)", messageId, id, actor, input.body().trim());
        return Map.of("id", messageId);
    }
    // Messaging is deliberately independent of tenant operations: an active owner
    // may communicate about a restricted organization without regaining access.
    private UUID requireOrganizationOwnerForMessages(UUID org) {
        UUID user = currentUser.getCurrentUserId();
        Integer count = db.queryForObject("SELECT count(*) FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? AND m.user_id=? AND m.role='owner' AND m.status='active' AND u.status='active'", Integer.class, org, user);
        if (count == null || count == 0) throw new AccessDeniedException("Active organization owner required");
        return user;
    }

    @GetMapping("/my-organizations/{id}/messages")
    public List<Map<String, Object>> ownerMessages(@PathVariable UUID id) {
        requireOrganizationOwnerForMessages(id);
        return db.queryForList("SELECT id, sender_user_id, body, direction, created_at, read_at, platform_read_at FROM organization_messages WHERE organization_id=? ORDER BY created_at, id", id);
    }

    @PostMapping("/my-organizations/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> ownerSend(@PathVariable UUID id, @Valid @RequestBody MessageInput input) {
        UUID user = requireOrganizationOwnerForMessages(id), messageId = UUID.randomUUID();
        db.update("INSERT INTO organization_messages (id,organization_id,sender_user_id,body,direction) VALUES (?,?,?,?, 'organization_to_platform')", messageId, id, user, input.body().trim());
        return Map.of("id", messageId);
    }

    @PostMapping("/my-organizations/{id}/messages/{messageId}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ownerRead(@PathVariable UUID id, @PathVariable UUID messageId) {
        requireOrganizationOwnerForMessages(id);
        if (db.update("UPDATE organization_messages SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND organization_id=? AND direction='platform_to_organization'", messageId, id) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found");
    }

    @GetMapping("/platform/organizations/{id}/messages")
    public List<Map<String, Object>> platformMessages(@PathVariable UUID id) {
        requirePlatformOwner();
        return db.queryForList("SELECT id, sender_user_id, body, direction, created_at, read_at, platform_read_at FROM organization_messages WHERE organization_id=? ORDER BY created_at, id", id);
    }

    @PostMapping("/platform/organizations/{id}/messages/{messageId}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void platformRead(@PathVariable UUID id, @PathVariable UUID messageId) {
        requirePlatformOwner();
        if (db.update("UPDATE organization_messages SET platform_read_at=COALESCE(platform_read_at,CURRENT_TIMESTAMP) WHERE id=? AND organization_id=? AND direction='organization_to_platform'", messageId, id) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found");
    }

    @GetMapping("/organizations/{id}/inbox")
    public List<Map<String, Object>> inbox(@PathVariable UUID id) {
        authorization.requirePermission(id, OrganizationPermission.MEMBERSHIP_MANAGE);
        return db.queryForList("SELECT id, sender_user_id, body, created_at, read_at FROM organization_messages WHERE organization_id = ? ORDER BY created_at DESC, id", id);
    }
    @PostMapping("/organizations/{id}/inbox/{messageId}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@PathVariable UUID id, @PathVariable UUID messageId) {
        authorization.requirePermission(id, OrganizationPermission.MEMBERSHIP_MANAGE);
        if (db.update("UPDATE organization_messages SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND organization_id = ?", messageId, id) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found");
    }
}
