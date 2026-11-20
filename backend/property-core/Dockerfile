# syntax=docker/dockerfile:1
#
# Multi-stage image for the Property SaaS API (property-core).
#
# Stage "build"   - resolve dependencies and package the Spring Boot fat jar on
#                   the pinned Maven/JDK 21 image (Maven 3.9.x, matching the
#                   repository toolchain).
# Stage "runtime" - run the fat jar on a minimal JRE 21 as a non-root user.
#
# Every setting that varies between environments (datasource URL and
# credentials, JWT and CSRF secrets, allowed browser origins, active profile)
# is supplied through environment variables at run time, so no secrets are baked
# into the image. Flyway migrations still run from the application lifecycle
# against `classpath:db/migration`; schema validation is unchanged.

ARG MAVEN_IMAGE=maven:3.9-eclipse-temurin-21
ARG JRE_IMAGE=eclipse-temurin:21-jre-alpine

# ---------------------------------------------------------------- build -------
FROM ${MAVEN_IMAGE} AS build

WORKDIR /workspace

# Warm the dependency cache from the POM alone so source-only edits do not
# re-download the world on every rebuild.
COPY pom.xml ./
RUN mvn -B -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -B -DskipTests package \
 && cp target/property-core-*.jar /workspace/app.jar

# -------------------------------------------------------------- runtime -------
FROM ${JRE_IMAGE} AS runtime

LABEL org.opencontainers.image.title="property-saas-backend" \
      org.opencontainers.image.description="Property SaaS Spring Boot API (property-core)"

# Non-root runtime user.
RUN addgroup -S -g 1001 spring \
 && adduser -S -u 1001 -G spring -h /app spring

WORKDIR /app
COPY --from=build --chown=1001:1001 /workspace/app.jar /app/app.jar

USER 1001

# Container-aware heap sizing plus a non-blocking entropy source for fast start.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=25.0 -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8081

# /actuator/health reports UP only once the datasource and Flyway are usable.
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=5 \
    CMD wget -q -O- http://127.0.0.1:8081/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
