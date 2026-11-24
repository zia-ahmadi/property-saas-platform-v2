package com.propertysaas.propertycore.renter;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
class RenterMigrationIntegrationTest {
    @Autowired DataSource dataSource;
    @Autowired JdbcTemplate jdbc;

    @Test
    void upgradesVersionFiveWithExistingOrganization() {
        String schema = "renter_migration_" + UUID.randomUUID().toString().replace("-", "");
        Flyway before = Flyway.configure().dataSource(dataSource).schemas(schema).target("5").load();
        Flyway after = Flyway.configure().dataSource(dataSource).schemas(schema).target("6").cleanDisabled(false).load();
        UUID org = UUID.randomUUID();
        UUID renter = UUID.randomUUID();
        try {
            before.migrate();
            assertEquals("5", before.info().current().getVersion().toString());
            jdbc.update("insert into " + schema + ".organizations (id, name, slug) values (?, 'Existing', 'existing')", org);
            assertEquals(1, after.migrate().migrationsExecuted);
            after.validate();
            assertEquals("6", after.info().current().getVersion().toString());
            jdbc.update("insert into " + schema + """
                    .renters (id, organization_id, first_name, last_name, created_at, updated_at)
                    values (?, ?, 'Ada', 'Lovelace', now(), now())
                    """, renter, org);
            assertEquals("Existing", jdbc.queryForObject("select name from " + schema + ".organizations where id = ?",
                    String.class, org));
            assertEquals(org, jdbc.queryForObject("select organization_id from " + schema + ".renters where id = ?",
                    UUID.class, renter));
            Flyway latest = Flyway.configure().dataSource(dataSource).schemas(schema).cleanDisabled(false).load();
            latest.migrate();
            assertEquals("13", latest.info().current().getVersion().toString());
            assertEquals("active", jdbc.queryForObject("select status from " + schema + ".organizations where id = ?", String.class, org));
        } finally {
            after.clean();
        }
    }
}
