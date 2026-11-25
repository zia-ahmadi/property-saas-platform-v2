FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml ./
RUN mvn -B -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package && cp target/property-notifications-*.jar /workspace/app.jar

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S -g 1001 spring && adduser -S -u 1001 -G spring spring
WORKDIR /app
COPY --from=build --chown=1001:1001 /workspace/app.jar /app/app.jar
USER 1001
EXPOSE 8082
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD wget -q -O- http://127.0.0.1:8082/actuator/health || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
