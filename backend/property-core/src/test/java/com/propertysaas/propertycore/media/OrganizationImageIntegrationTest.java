package com.propertysaas.propertycore.media;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OrganizationImageIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;

    @Test
    void imageUploadAndRetrievalStayOrganizationScoped() throws Exception {
        UUID owner = UUID.randomUUID(), organization = UUID.randomUUID(), otherOrganization = UUID.randomUUID();
        UUID property = UUID.randomUUID(), otherProperty = UUID.randomUUID(), unit = UUID.randomUUID(), renter = UUID.randomUUID();
        db.update("insert into users(id,email,password_hash,first_name,last_name) values (?,?, 'hash','Test','Owner')",
                owner, owner + "@example.test");
        db.update("insert into organizations(id,name,slug) values (?, 'Image test',?), (?, 'Other image test',?)",
                organization, organization.toString(), otherOrganization, otherOrganization.toString());
        db.update("insert into organization_memberships(id,organization_id,user_id,role) values (?,?,?,'owner'), (?,?,?,'owner')",
                UUID.randomUUID(), organization, owner, UUID.randomUUID(), otherOrganization, owner);
        db.update("insert into properties(id,organization_id,name,property_type,address_line1,city,country_code) values (?,?,'Image property','apartment','1 Main St','Test City','US'), (?,?,'Other property','apartment','2 Main St','Test City','US')",
                property, organization, otherProperty, otherOrganization);
        db.update("insert into units(id,property_id,unit_number,unit_type) values (?,?,'101','apartment')", unit, property);
        db.update("insert into renters(id,organization_id,first_name,last_name,created_at,updated_at) values (?,?,'Test','Renter',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                renter, organization);
        var ownerJwt = SecurityMockMvcRequestPostProcessors.jwt().jwt(jwt -> jwt.subject(owner.toString()));
        byte[] png = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lVQAAAAASUVORK5CYII=");
        var upload = new MockMultipartFile("file", "property.png", "image/png", png);
        String base = "/api/v1/organizations/" + organization + "/images/";
        for (String resource : new String[]{"property/" + property, "unit/" + unit, "renter/" + renter}) {
            String path = base + resource;
            mvc.perform(multipart(path).file(upload).with(ownerJwt).with(request -> {
                        request.setMethod("PUT");
                        return request;
                    }))
                    .andExpect(status().isNoContent());
            mvc.perform(get(path).with(ownerJwt))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType("image/png"))
                    .andExpect(content().bytes(png));
            mvc.perform(delete(path).with(ownerJwt)).andExpect(status().isNoContent());
            mvc.perform(get(path).with(ownerJwt)).andExpect(status().isNoContent());
        }
        mvc.perform(get("/api/v1/organizations/" + otherOrganization + "/images/property/" + property).with(ownerJwt))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsUnsupportedImageData() throws Exception {
        UUID owner = UUID.randomUUID(), organization = UUID.randomUUID(), property = UUID.randomUUID();
        db.update("insert into users(id,email,password_hash,first_name,last_name) values (?,?, 'hash','Test','Owner')",
                owner, owner + "@example.test");
        db.update("insert into organizations(id,name,slug) values (?, 'Image test',?)", organization, organization.toString());
        db.update("insert into organization_memberships(id,organization_id,user_id,role) values (?,?,?,'owner')",
                UUID.randomUUID(), organization, owner);
        db.update("insert into properties(id,organization_id,name,property_type,address_line1,city,country_code) values (?,?,'Image property','apartment','1 Main St','Test City','US')",
                property, organization);
        var ownerJwt = SecurityMockMvcRequestPostProcessors.jwt().jwt(jwt -> jwt.subject(owner.toString()));
        var upload = new MockMultipartFile("file", "not-image.png", "image/png", "not an image".getBytes());

        mvc.perform(multipart("/api/v1/organizations/{organizationId}/images/property/{resourceId}", organization, property)
                        .file(upload).with(ownerJwt).with(request -> {
                            request.setMethod("PUT");
                            return request;
                        }))
                .andExpect(status().isBadRequest());
    }
}
