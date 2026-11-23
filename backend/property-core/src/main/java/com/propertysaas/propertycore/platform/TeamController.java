package com.propertysaas.propertycore.platform;

import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.config.security.authentication.AuthenticatedUserService;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class TeamController {
    private final JdbcTemplate db;
    private final AuthenticatedUserService currentUser;
    private final CurrentUserAuthorizationService auth;
    private final PasswordEncoder passwords;
    public TeamController(JdbcTemplate db, AuthenticatedUserService currentUser, CurrentUserAuthorizationService auth, PasswordEncoder passwords) {
        this.db = db; this.currentUser = currentUser; this.auth = auth; this.passwords = passwords;
    }
    record Invite(@NotBlank @Email @Size(max=320) String email, @NotBlank String role) { }
    record RoleChange(@NotBlank String role) { }
    record Accept(@NotBlank String token) { }
    record NewAccount(@NotBlank String token, @NotBlank @Email @Size(max=320) String email,
                      @NotBlank @Size(min=12,max=72) String password,
                      @NotBlank @Size(max=100) String firstName, @NotBlank @Size(max=100) String lastName) { }
    private void owner(UUID org) { auth.requirePermission(org, OrganizationPermission.MEMBERSHIP_MANAGE); }
    private String role(String value) {
        String r = value.trim().toLowerCase(Locale.ROOT);
        if (!Set.of("admin", "manager", "staff").contains(r)) throw new IllegalArgumentException("Role must be ADMIN, MANAGER, or STAFF");
        return r;
    }
    private static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private void audit(UUID org, UUID actor, String action, String email, String detail) {
        db.update("INSERT INTO organization_team_audit (id, organization_id, actor_user_id, action, target_email, detail) VALUES (?, ?, ?, ?, ?, ?)", UUID.randomUUID(), org, actor, action, email, detail);
    }
    @GetMapping("/organizations/{org}/team")
    public Map<String,Object> team(@PathVariable UUID org) {
        owner(org);
        return Map.of("members", db.queryForList("SELECT m.id, m.user_id, u.email, u.first_name, u.last_name, m.role, m.status FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY u.email", org),
                "invitations", db.queryForList("SELECT id, email, role, created_at, expires_at FROM organization_invitations WHERE organization_id=? AND accepted_at IS NULL AND cancelled_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC", org));
    }
    @Transactional
    @PostMapping("/organizations/{org}/invitations") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> invite(@PathVariable UUID org, @Valid @RequestBody Invite request) {
        owner(org); UUID actor = currentUser.getCurrentUserId(); String email = request.email().trim().toLowerCase(Locale.ROOT); String role = role(request.role());
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes); String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); UUID id = UUID.randomUUID();
        db.update("INSERT INTO organization_invitations (id, organization_id, email, role, token_hash, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP + INTERVAL '7 days')", id, org, email, role, hash(token), actor);
        audit(org, actor, "INVITED", email, role);
        return Map.of("id", id, "token", token, "delivery", "shareable_link", "expiresInDays", 7);
    }
    @Transactional
    @DeleteMapping("/organizations/{org}/invitations/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable UUID org, @PathVariable UUID id) {
        owner(org); var rows = db.queryForList("UPDATE organization_invitations SET cancelled_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=? AND accepted_at IS NULL AND cancelled_at IS NULL RETURNING email", id, org);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found");
        audit(org, currentUser.getCurrentUserId(), "INVITATION_CANCELLED", (String)rows.get(0).get("email"), null);
    }
    @Transactional
    @PatchMapping("/organizations/{org}/members/{id}")
    public void change(@PathVariable UUID org, @PathVariable UUID id, @Valid @RequestBody RoleChange request) {
        owner(org); String r = role(request.role());
        var rows = db.queryForList("UPDATE organization_memberships SET role=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=? AND status='active' AND role <> 'owner' RETURNING user_id", r, id, org);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Eligible member not found");
        String email = db.queryForObject("SELECT email FROM users WHERE id=?", String.class, rows.get(0).get("user_id"));
        audit(org, currentUser.getCurrentUserId(), "ROLE_CHANGED", email, r);
    }
    @Transactional
    @DeleteMapping("/organizations/{org}/members/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable UUID org, @PathVariable UUID id) {
        owner(org);
        var rows = db.queryForList("UPDATE organization_memberships SET status='suspended', updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=? AND status='active' AND role <> 'owner' RETURNING user_id", id, org);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Eligible member not found");
        String email = db.queryForObject("SELECT email FROM users WHERE id=?", String.class, rows.get(0).get("user_id"));
        audit(org, currentUser.getCurrentUserId(), "REVOKED", email, null);
    }
    @Transactional
    @PostMapping("/invitations/accept")
    public Map<String,UUID> accept(@Valid @RequestBody Accept request) {
        UUID user = currentUser.getCurrentUserId();
        var users = db.queryForList("SELECT email FROM users WHERE id=? AND status='active'", user);
        if (users.isEmpty()) throw new org.springframework.security.access.AccessDeniedException("Active account required");
        return acceptFor(request.token(), user, (String) users.get(0).get("email"));
    }
    @Transactional
    @PostMapping("/invitations/accept-new") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,UUID> acceptNew(@Valid @RequestBody NewAccount request) {
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) throw new IllegalArgumentException("Password must not exceed 72 UTF-8 bytes");
        String email=request.email().trim().toLowerCase(Locale.ROOT);
        if (Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM users WHERE lower(email)=?)", Boolean.class, email))) throw new ConflictException("An account with this email already exists; sign in to accept");
        UUID user=UUID.randomUUID();
        db.update("INSERT INTO users (id,email,password_hash,first_name,last_name) VALUES (?,?,?,?,?)", user,email,passwords.encode(request.password()),request.firstName().trim(),request.lastName().trim());
        return acceptFor(request.token(),user,email);
    }
    private Map<String,UUID> acceptFor(String token, UUID user, String email) {
        var rows=db.queryForList("SELECT i.id, i.organization_id, i.email, i.role FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id WHERE i.token_hash=? AND i.accepted_at IS NULL AND i.cancelled_at IS NULL AND i.expires_at > CURRENT_TIMESTAMP AND o.status='active' FOR UPDATE OF i", hash(token));
        if (rows.isEmpty()) throw new ConflictException("Invitation is invalid, expired, or unavailable");
        var invite=rows.get(0);
        if (!email.equalsIgnoreCase((String)invite.get("email"))) throw new org.springframework.security.access.AccessDeniedException("Invitation email does not match account");
        UUID org=(UUID)invite.get("organization_id");
        var existing=db.queryForList("SELECT id, status, role FROM organization_memberships WHERE organization_id=? AND user_id=? FOR UPDATE", org,user);
        if (!existing.isEmpty() && ("active".equals(existing.get(0).get("status")) || "owner".equals(existing.get(0).get("role")))) throw new ConflictException("Already a member");
        if (existing.isEmpty()) db.update("INSERT INTO organization_memberships (id,organization_id,user_id,role,status) VALUES (?,?,?,?, 'active')", UUID.randomUUID(),org,user,invite.get("role"));
        else db.update("UPDATE organization_memberships SET role=?,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?",invite.get("role"),existing.get(0).get("id"));
        db.update("UPDATE organization_invitations SET accepted_at=CURRENT_TIMESTAMP WHERE id=?",invite.get("id"));
        audit(org,user,"INVITATION_ACCEPTED",email,(String)invite.get("role"));
        return Map.of("organizationId",org);
    }
}
