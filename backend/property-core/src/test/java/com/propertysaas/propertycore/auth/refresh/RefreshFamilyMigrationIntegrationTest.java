package com.propertysaas.propertycore.auth.refresh;

import com.propertysaas.propertycore.PropertyCoreApplication;
import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ConfigurableApplicationContext;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class RefreshFamilyMigrationIntegrationTest {
    @Autowired DataSource dataSource;
    @Autowired RefreshTokenService service;

    @Test
    void v5PreservesExistingSession() throws Exception {
        String schema = "migration_test_" + UUID.randomUUID().toString().replace("-", "");
        Flyway before = Flyway.configure().dataSource(dataSource).schemas(schema).target("4").cleanDisabled(false).load();
        Flyway after = Flyway.configure().dataSource(dataSource).schemas(schema).cleanDisabled(false).load();
        UUID user = UUID.randomUUID(), family = UUID.randomUUID(), token = UUID.randomUUID();
        String rawToken = "legacy-v4-token-" + UUID.randomUUID();
        String hash = service.hashToken(rawToken);
        try {
            before.migrate();
            try (Connection c = dataSource.getConnection()) {
                try (PreparedStatement s = c.prepareStatement("INSERT INTO " + schema + ".users (id,email,password_hash,first_name,last_name) VALUES (?, ?, 'hash', 'Test', 'User')")) {
                    s.setObject(1, user); s.setString(2, user + "@example.com"); s.executeUpdate();
                }
                try (PreparedStatement s = c.prepareStatement("INSERT INTO " + schema + ".refresh_tokens (id,user_id,family_id,token_hash,expires_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP + INTERVAL '1 day')")) {
                    s.setObject(1, token); s.setObject(2, user); s.setObject(3, family); s.setString(4, hash); s.executeUpdate();
                }
            }
            after.migrate();
            after.validate();
            try (Connection c = dataSource.getConnection()) {
                try (PreparedStatement s = c.prepareStatement("SELECT t.id,t.user_id,t.family_id,t.token_hash,t.revoked_at,t.expires_at,f.user_id FROM " + schema + ".refresh_tokens t JOIN " + schema + ".refresh_token_families f ON f.id=t.family_id WHERE t.id=?")) {
                    s.setObject(1, token);
                    try (ResultSet rs = s.executeQuery()) {
                        assertTrue(rs.next());
                        assertEquals(token, rs.getObject(1)); assertEquals(user, rs.getObject(2));
                        assertEquals(family, rs.getObject(3)); assertEquals(hash, rs.getString(4));
                        assertNull(rs.getObject(5)); assertNotNull(rs.getObject(6)); assertEquals(user, rs.getObject(7));
                        assertFalse(rs.next());
                    }
                }
            }
            String databaseUrl;
            try (Connection c = dataSource.getConnection()) {
                databaseUrl = c.getMetaData().getURL();
            }
            String schemaUrl = databaseUrl + (databaseUrl.contains("?") ? "&" : "?") + "currentSchema=" + schema;
            try (ConfigurableApplicationContext isolated = new SpringApplicationBuilder(PropertyCoreApplication.class)
                    .run("--spring.datasource.url=" + schemaUrl,
                            "--spring.jpa.properties.hibernate.default_schema=" + schema,
                            "--spring.flyway.enabled=false", "--server.port=0")) {
                DataSource isolatedDataSource = isolated.getBean(DataSource.class);
                try (Connection c = isolatedDataSource.getConnection();
                     PreparedStatement s = c.prepareStatement("SELECT current_schema()" );
                     ResultSet rs = s.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(schema, rs.getString(1));
                }
                String replacement = isolated.getBean(RefreshTokenService.class).rotateToken(rawToken);
                assertNotEquals(rawToken, replacement);
                try (Connection c = dataSource.getConnection();
                     PreparedStatement s = c.prepareStatement("SELECT old.revoked_at, old.replaced_by_token_id, replacement.token_hash, replacement.revoked_at, replacement.family_id FROM " + schema + ".refresh_tokens old JOIN " + schema + ".refresh_tokens replacement ON old.replaced_by_token_id = replacement.id WHERE old.id = ?")) {
                    s.setObject(1, token);
                    try (ResultSet rs = s.executeQuery()) {
                        assertTrue(rs.next());
                        assertNotNull(rs.getObject(1));
                        assertNotNull(rs.getObject(2));
                        assertEquals(service.hashToken(replacement), rs.getString(3));
                        assertNull(rs.getObject(4));
                        assertEquals(family, rs.getObject(5));
                        assertFalse(rs.next());
                    }
                }
            }
        } finally { after.clean(); }
    }
}
