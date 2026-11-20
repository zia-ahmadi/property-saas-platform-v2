package com.propertysaas.propertycore.config.security.browser;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.cors.CorsUtils;
import java.io.IOException;
import java.util.Collections;

public class BrowserSecurityFilter extends OncePerRequestFilter {
    private final BrowserSecurity security;
    public BrowserSecurityFilter(BrowserSecurity security) { this.security = security; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (path.equals("/api/v1/browser-auth") || path.startsWith("/api/v1/browser-auth/")) {
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("Pragma", "no-cache");
            if (!"GET".equals(request.getMethod()) && !"HEAD".equals(request.getMethod())) {
                var originHeaders = Collections.list(request.getHeaders("Origin"));
                boolean exactOrigin = originHeaders.size() == 1 && security.origins().contains(originHeaders.getFirst());
                // The CORS layer trims trailing slashes before matching, so a
                // non-browser Origin such as "https://app.example.test/" would be
                // accepted on preflight. Enforce the exact configured Origin here
                // for every unsafe method, and additionally require CSRF for the
                // actual (non-preflight) request.
                boolean csrf = CorsUtils.isPreFlightRequest(request) || security.validCsrf(request);
                if (!exactOrigin || !csrf) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"status\":403,\"error\":\"Forbidden\",\"message\":\"Request rejected\"}");
                    return;
                }
            }
        }
        chain.doFilter(request, response);
    }
}
