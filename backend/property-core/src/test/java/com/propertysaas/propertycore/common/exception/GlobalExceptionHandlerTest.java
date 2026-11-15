
package com.propertysaas.propertycore.common.exception;

import org.junit.jupiter.api.Test;

import org.springframework.web.server.ResponseStatusException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler exceptionHandler =
            new GlobalExceptionHandler();

    @Test
    void accessDeniedShouldReturn403Forbidden() {

        MockHttpServletRequest request =
                new MockHttpServletRequest();

        request.setRequestURI(
                "/api/v1/organizations/test/properties"
        );

        AccessDeniedException exception =
                new AccessDeniedException(
                        "User lacks PROPERTY_MANAGE permission"
                );

        ResponseEntity<ErrorResponse> response =
                exceptionHandler.handleAccessDeniedException(
                        exception,
                        request
                );

        assertEquals(
                HttpStatus.FORBIDDEN,
                response.getStatusCode()
        );

        ErrorResponse body = response.getBody();

        assertNotNull(body);
        assertEquals(403, body.status());
        assertEquals("Forbidden", body.error());

        assertEquals(
                "You do not have permission to access this resource.",
                body.message()
        );

        assertEquals(
                "/api/v1/organizations/test/properties",
                body.path()
        );

        assertNotNull(body.timestamp());
    }

@Test
void organizationNotFoundShouldReturn404() {

    MockHttpServletRequest request =
            new MockHttpServletRequest();

    request.setRequestURI(
            "/api/v1/organizations/00000000-0000-0000-0000-000000000001"
    );

    ResponseStatusException exception =
            new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Organization not found"
            );

    ResponseEntity<ErrorResponse> response =
            exceptionHandler.handleResponseStatusException(
                    exception,
                    request
            );

    assertEquals(
            HttpStatus.NOT_FOUND,
            response.getStatusCode()
    );

    ErrorResponse body = response.getBody();

    assertNotNull(body);
    assertEquals(404, body.status());
    assertEquals("Not Found", body.error());
    assertEquals("Organization not found", body.message());

    assertEquals(
            "/api/v1/organizations/00000000-0000-0000-0000-000000000001",
            body.path()
    );

    assertNotNull(body.timestamp());
}

}
