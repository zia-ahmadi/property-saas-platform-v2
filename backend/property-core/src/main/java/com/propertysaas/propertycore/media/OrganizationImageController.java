package com.propertysaas.propertycore.media;

import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/images")
public class OrganizationImageController {
    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    private static final long MAX_IMAGE_PIXELS = 10_000_000L;
    private static final Set<String> RESOURCE_TYPES = Set.of("property", "unit", "renter", "organization");

    private final JdbcTemplate db;
    private final AuthenticatedOrganizationContextResolver contexts;
    private final CurrentUserAuthorizationService authorization;

    public OrganizationImageController(
            JdbcTemplate db,
            AuthenticatedOrganizationContextResolver contexts,
            CurrentUserAuthorizationService authorization
    ) {
        this.db = db;
        this.contexts = contexts;
        this.authorization = authorization;
    }

    @GetMapping("/{resourceType}/{resourceId}")
    public ResponseEntity<byte[]> get(
            @PathVariable UUID organizationId,
            @PathVariable String resourceType,
            @PathVariable UUID resourceId
    ) {
        contexts.resolve(organizationId);
        String type = resourceType(resourceType);
        requireResource(organizationId, type, resourceId, false);
        var images = db.query(
                "SELECT media_type, image_data FROM organization_images WHERE organization_id = ? AND resource_type = ? AND resource_id = ?",
                (result, row) -> new StoredImage(result.getString("media_type"), result.getBytes("image_data")),
                organizationId, type, resourceId
        );
        if (images.isEmpty()) return ResponseEntity.noContent().build();

        StoredImage image = images.get(0);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.mediaType()))
                .cacheControl(CacheControl.noCache().cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .body(image.data());
    }

    @PutMapping(path = "/{resourceType}/{resourceId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> put(
            @PathVariable UUID organizationId,
            @PathVariable String resourceType,
            @PathVariable UUID resourceId,
            @RequestPart("file") MultipartFile file
    ) {
        contexts.resolve(organizationId);
        String type = resourceType(resourceType);
        authorization.requirePermission(organizationId, type.equals("organization")
                ? OrganizationPermission.ORGANIZATION_MANAGE : OrganizationPermission.PROPERTY_MANAGE);
        requireResource(organizationId, type, resourceId, true);
        StoredImage image = validateImage(file);
        db.update("""
                INSERT INTO organization_images (organization_id, resource_type, resource_id, media_type, image_data)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (organization_id, resource_type, resource_id)
                DO UPDATE SET media_type = EXCLUDED.media_type, image_data = EXCLUDED.image_data,
                              updated_at = CURRENT_TIMESTAMP
                """, organizationId, type, resourceId, image.mediaType(), image.data());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{resourceType}/{resourceId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID organizationId,
            @PathVariable String resourceType,
            @PathVariable UUID resourceId
    ) {
        contexts.resolve(organizationId);
        String type = resourceType(resourceType);
        authorization.requirePermission(organizationId, type.equals("organization")
                ? OrganizationPermission.ORGANIZATION_MANAGE : OrganizationPermission.PROPERTY_MANAGE);
        requireResource(organizationId, type, resourceId, true);
        db.update("DELETE FROM organization_images WHERE organization_id = ? AND resource_type = ? AND resource_id = ?",
                organizationId, type, resourceId);
        return ResponseEntity.noContent().build();
    }

    private String resourceType(String value) {
        String type = value.toLowerCase(Locale.ROOT);
        if (!RESOURCE_TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported image resource type");
        }
        return type;
    }

    private void requireResource(UUID organizationId, String type, UUID resourceId, boolean write) {
        String state = switch (type) {
            case "organization" -> organizationId.equals(resourceId) ? "active" : null;
            case "property" -> db.query(
                    "SELECT status FROM properties WHERE id = ? AND organization_id = ?",
                    result -> result.next() ? result.getString(1) : null, resourceId, organizationId);
            case "unit" -> db.query("""
                    SELECT p.status FROM units u JOIN properties p ON p.id = u.property_id
                    WHERE u.id = ? AND p.organization_id = ?
                    """, result -> result.next() ? result.getString(1) : null, resourceId, organizationId);
            case "renter" -> db.query("""
                    SELECT CASE WHEN archived_at IS NULL THEN 'active' ELSE 'archived' END
                    FROM renters WHERE id = ? AND organization_id = ?
                    """, result -> result.next() ? result.getString(1) : null, resourceId, organizationId);
            default -> throw new IllegalStateException("Validated image resource type expected");
        };
        if (state == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image resource not found");
        }
        if (write && !state.equals("active")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Images cannot be changed for archived resources");
        }
    }

    private StoredImage validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an image to upload");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Images must be 5 MB or smaller");
        }
        try {
            byte[] data = file.getBytes();
            try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
                if (input == null) throw invalidImage();
                Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw invalidImage();
                ImageReader reader = readers.next();
                try {
                    reader.setInput(input, true, true);
                    String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                    String mediaType = switch (format) {
                        case "jpeg", "jpg" -> "image/jpeg";
                        case "png" -> "image/png";
                        default -> throw invalidImage();
                    };
                    int width = reader.getWidth(0);
                    int height = reader.getHeight(0);
                    if (width <= 0 || height <= 0 || (long) width * height > MAX_IMAGE_PIXELS
                            || reader.read(0) == null) {
                        throw invalidImage();
                    }
                    return new StoredImage(mediaType, data);
                } finally {
                    reader.dispose();
                }
            }
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The image file could not be read", error);
        }
    }

    private static ResponseStatusException invalidImage() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload a valid JPEG or PNG image");
    }

    private record StoredImage(String mediaType, byte[] data) { }
}
