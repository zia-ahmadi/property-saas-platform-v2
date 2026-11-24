package com.propertysaas.propertycore.billing;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class BillingIntegrationTest {
    private static final String URL = "/api/v1/organizations/{org}/billing/invoices";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtEncoder encoder;
    @Value("${app.jwt.issuer}") String issuer;
    private final List<Fixture> fixtures = new ArrayList<>();

    @Test
    void invoicesUseLeaseTermsAndPaymentsUpdateTheLedgerExactlyOnce() throws Exception {
        Fixture owner = fixture("owner");
        String body = invoice(owner.lease(), month(), today().minusDays(1));
        String id = issue(owner, body).andExpect(status().isCreated())
                .andExpect(jsonPath("$.invoice.status").value("OVERDUE"))
                .andExpect(jsonPath("$.invoice.currency").value("USD"))
                .andExpect(jsonPath("$.invoice.amount").value(1250.75))
                .andExpect(jsonPath("$.invoice.renterName").value("Test Renter"))
                .andReturn().getResponse().getHeader("Location").replaceFirst(".*/", "");
        issue(owner, body).andExpect(status().isConflict());

        change(owner, id, "payments", payment("300.25", 0))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoice.balance").value(950.50))
                .andExpect(jsonPath("$.payments[0].amount").value(300.25));
        change(owner, id, "payments", payment("300.25", 0)).andExpect(status().isConflict());
        change(owner, id, "payments", payment("950.51", 1)).andExpect(status().isConflict());
        change(owner, id, "void", "{\"reason\":\"Duplicate\",\"version\":1}").andExpect(status().isConflict());

        mvc.perform(get(URL, owner.org()).header("Authorization", owner.bearer())
                        .param("search", "test renter").param("status", "OVERDUE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get(URL + "/summary", owner.org()).header("Authorization", owner.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.overdue").value(1))
                .andExpect(jsonPath("$.totals[0].overdue").value(950.50))
                .andExpect(jsonPath("$.totals[0].collected").value(300.25));

        change(owner, id, "payments", payment("950.50", 1)).andExpect(status().isOk())
                .andExpect(jsonPath("$.invoice.status").value("PAID"))
                .andExpect(jsonPath("$.invoice.balance").value(0))
                .andExpect(jsonPath("$.payments.length()").value(2));
    }

    @Test
    void voidingRetainsHistoryAndFreesTheMonthForReissue() throws Exception {
        Fixture admin = fixture("admin");
        String body = invoice(admin.lease(), month(), today());
        String id = issue(admin, body).andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location").replaceFirst(".*/", "");
        change(admin, id, "void", "{\"reason\":\"Incorrect due date\",\"version\":0}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.invoice.status").value("VOID"))
                .andExpect(jsonPath("$.invoice.balance").value(0))
                .andExpect(jsonPath("$.invoice.voidReason").value("Incorrect due date"));
        change(admin, id, "payments", payment("10", 1)).andExpect(status().isConflict());
        issue(admin, body).andExpect(status().isCreated()).andExpect(jsonPath("$.invoice.status").value("OPEN"));
        issue(admin, invoice(admin.lease(), month().minusMonths(1), today())).andExpect(status().isBadRequest());
    }

    @Test
    void organizationAndRoleBoundariesApplyToReadsAndWrites() throws Exception {
        Fixture first = fixture("owner");
        Fixture other = fixture("owner");
        Fixture staff = fixture("staff");
        mvc.perform(get(URL, first.org())).andExpect(status().isUnauthorized());
        mvc.perform(get(URL, first.org()).header("Authorization", other.bearer())).andExpect(status().isForbidden());
        mvc.perform(get(URL + "/summary", staff.org()).header("Authorization", staff.bearer())).andExpect(status().isForbidden());
        issue(staff, invoice(staff.lease(), month(), today())).andExpect(status().isForbidden());
        issue(first, invoice(other.lease(), month(), today())).andExpect(status().isNotFound());
        String id = issue(other, invoice(other.lease(), month(), today())).andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location").replaceFirst(".*/", "");
        mvc.perform(get(URL + "/{id}", first.org(), id).header("Authorization", first.bearer()))
                .andExpect(status().isNotFound());
        change(first, id, "payments", payment("10", 0)).andExpect(status().isNotFound());
        change(first, id, "void", "{\"reason\":\"Duplicate\",\"version\":0}").andExpect(status().isNotFound());
        mvc.perform(get(URL, first.org()).header("Authorization", first.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    private ResultActions issue(Fixture user, String body) throws Exception {
        return mvc.perform(post(URL, user.org()).header("Authorization", user.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions change(Fixture user, String id, String action, String body) throws Exception {
        return mvc.perform(post(URL + "/{id}/" + action, user.org(), id).header("Authorization", user.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static String invoice(UUID lease, LocalDate month, LocalDate due) {
        return """
                {"leaseId":"%s","billingMonth":"%s","dueOn":"%s"}
                """.formatted(lease, month, due);
    }

    private static String payment(String amount, int version) {
        return """
                {"amount":%s,"receivedOn":"%s","method":"BANK_TRANSFER","reference":"Receipt","version":%d}
                """.formatted(amount, today(), version);
    }

    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    private static LocalDate month() {
        return YearMonth.from(today()).atDay(1);
    }

    private Fixture fixture(String role) {
        UUID org = UUID.randomUUID(), user = UUID.randomUUID(), property = UUID.randomUUID();
        UUID unit = UUID.randomUUID(), renter = UUID.randomUUID(), lease = UUID.randomUUID();
        jdbc.update("INSERT INTO organizations(id,name,slug) VALUES (?, 'Billing test', ?)", org, "billing-" + org);
        jdbc.update("INSERT INTO users(id,email,password_hash,first_name,last_name) VALUES (?,?,'test-hash','Test','User')",
                user, user + "@example.test");
        jdbc.update("INSERT INTO organization_memberships(organization_id,user_id,role) VALUES (?,?,?)", org, user, role);
        jdbc.update("""
                INSERT INTO properties(id,organization_id,name,property_type,address_line1,city,country_code)
                VALUES (?,?,'Test property','house','Test street','Kabul','AF')
                """, property, org);
        jdbc.update("INSERT INTO units(id,property_id,unit_number,unit_type) VALUES (?,?,'1A','apartment')", unit, property);
        jdbc.update("""
                INSERT INTO renters(id,organization_id,first_name,last_name,created_at,updated_at)
                VALUES (?,?,'Test','Renter',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                """, renter, org);
        jdbc.update("""
                INSERT INTO leases(id,organization_id,property_id,unit_id,renter_id,starts_on,monthly_rent,
                                   deposit,currency,status,activated_at)
                VALUES (?,?,?,?,?,?,1250.75,0,'USD','ACTIVE',CURRENT_TIMESTAMP)
                """, lease, org, property, unit, renter, month());
        Instant now = Instant.now();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder().issuer(issuer).subject(user.toString()).issuedAt(now)
                        .expiresAt(now.plusSeconds(600)).build())).getTokenValue();
        Fixture fixture = new Fixture(org, user, lease, "Bearer " + token);
        fixtures.add(fixture);
        return fixture;
    }

    @AfterEach
    void cleanup() {
        for (Fixture f : fixtures) {
            jdbc.update("DELETE FROM rent_payments WHERE organization_id = ?", f.org());
            jdbc.update("DELETE FROM rent_invoices WHERE organization_id = ?", f.org());
            jdbc.update("DELETE FROM leases WHERE organization_id = ?", f.org());
            jdbc.update("DELETE FROM renters WHERE organization_id = ?", f.org());
            jdbc.update("DELETE FROM units WHERE property_id IN (SELECT id FROM properties WHERE organization_id = ?)", f.org());
            jdbc.update("DELETE FROM properties WHERE organization_id = ?", f.org());
            jdbc.update("DELETE FROM organization_memberships WHERE organization_id = ?", f.org());
            jdbc.update("DELETE FROM users WHERE id = ?", f.user());
            jdbc.update("DELETE FROM organizations WHERE id = ?", f.org());
        }
    }

    private record Fixture(UUID org, UUID user, UUID lease, String bearer) {}
}
