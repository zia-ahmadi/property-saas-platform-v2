package com.propertysaas.propertycore.auth;

import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.browser.allowed-origins=https://app.example.test", "app.browser.csrf-secret=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="})
@AutoConfigureMockMvc
class BrowserLogoutFailureIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoSpyBean RefreshTokenService refreshTokens;

    @Test
    void databaseFailureIsNotReportedAsSuccessfulLogout() throws Exception {
        var csrf = mvc.perform(get("/api/v1/browser-auth/csrf")).andExpect(status().isOk()).andReturn();
        String token = mapper.readTree(csrf.getResponse().getContentAsString()).get("csrfToken").stringValue();
        doThrow(new DataAccessResourceFailureException("database unavailable")).when(refreshTokens).revokeFamily(anyString());
        mvc.perform(post("/api/v1/browser-auth/logout").header("Origin", "https://app.example.test")
                        .header("X-CSRF-TOKEN", token).cookie(csrf.getResponse().getCookie("__Host-csrf"), new Cookie("__Host-refresh", "test")))
                .andExpect(status().isInternalServerError()).andExpect(header().doesNotExist("Set-Cookie"));
    }
}
