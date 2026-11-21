package com.propertysaas.propertycore.renter;

import com.propertysaas.propertycore.common.response.PageResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/renters")
public class RenterController {
    private final RenterService renters;

    public RenterController(RenterService renters) {
        this.renters = renters;
    }

    @PostMapping
    public ResponseEntity<RenterResponse> create(@PathVariable UUID organizationId,
                                                  @RequestBody JsonNode input) {
        var renter = renters.create(organizationId, input);
        return ResponseEntity.created(URI.create("/api/v1/organizations/" + organizationId
                + "/renters/" + renter.id())).body(renter);
    }

    @GetMapping
    public PageResponse<RenterResponse> list(@PathVariable UUID organizationId,
                                              @RequestParam(defaultValue = "") String search,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "10") int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Page must be >= 0 and size must be between 1 and 100");
        }
        if (search.length() > 254 || search.indexOf(0) >= 0) {
            throw new IllegalArgumentException("Search must be valid text of at most 254 characters");
        }
        return PageResponse.from(renters.list(organizationId, search, page, size));
    }

    @GetMapping("/{renterId}")
    public RenterResponse get(@PathVariable UUID organizationId, @PathVariable UUID renterId) {
        return renters.get(organizationId, renterId);
    }

    @PatchMapping("/{renterId}")
    public RenterResponse update(@PathVariable UUID organizationId, @PathVariable UUID renterId,
                                 @RequestBody JsonNode changes) {
        return renters.update(organizationId, renterId, changes);
    }

    @PatchMapping("/{renterId}/archive")
    public RenterResponse archive(@PathVariable UUID organizationId, @PathVariable UUID renterId) {
        return renters.archive(organizationId, renterId);
    }
}
