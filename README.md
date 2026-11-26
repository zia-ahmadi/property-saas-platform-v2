# Property SaaS Platform

A multi-tenant property management platform for managing properties, rental units, renters, leases, rent payments, maintenance requests, and organization teams from one centralized workspace.

Built with React, TypeScript, Spring Boot, and PostgreSQL, the platform provides organization-level access control, platform administration, and real-time notification capabilities.

> **Project status:** Active development. Features and APIs may evolve.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Using the Application](#using-the-application)
- [Docker Commands](#docker-commands)
- [Local Development](#local-development)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Security](#security)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

Property SaaS helps property management organizations manage their rental operations through a centralized web application.

Each organization operates within its own tenant context. Users can belong to organizations with different roles, and backend authorization protects organization-specific operations.

The platform consists of three main application services:

- **Frontend:** A React-based interface for organization workspaces and platform administration.
- **Property Core:** The main Spring Boot service responsible for business operations, authentication, authorization, and persistent data.
- **Property Notifications:** A Spring WebFlux service providing GraphQL operations and notification streams.

PostgreSQL stores application data, while Docker Compose provides a reproducible deployment environment.

## Features

- **Authentication:** User registration, login, session management, token refresh, and logout.
- **Multi-tenancy:** Organization registration, organization selection, and tenant-scoped data access.
- **Role-based access control:** OWNER, ADMIN, MANAGER, and STAFF roles.
- **Property management:** Create, view, and manage property records.
- **Unit management:** Manage rental units associated with properties.
- **Renter management:** Maintain renter records and profiles.
- **Leasing:** Manage lease-related information and workflows.
- **Billing:** Record and manage rent payments.
- **Maintenance:** Manage maintenance requests and their statuses.
- **Team management:** Invite users, assign roles, and manage memberships.
- **Platform administration:** Review organizations, manage organization status, and communicate with organization owners.
- **Notifications:** Retrieve notification history and receive streamed maintenance and payment events.
- **API contracts:** REST OpenAPI specifications and GraphQL contracts.

There are no default platform-owner credentials. Platform-owner provisioning requires an operator with controlled database access. See [Platform Administration](backend/property-core/PLATFORM_ADMINISTRATION.md).

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Java 21, Spring Boot 4 |
| Backend capabilities | Spring MVC, Spring Security, Spring Data JPA, Spring GraphQL |
| Notifications | Spring WebFlux, GraphQL, Server-Sent Events |
| Database | PostgreSQL 15 |
| Migrations | Flyway |
| API contracts | OpenAPI, GraphQL |
| Web server | Nginx |
| Containerization | Docker, Docker Compose |

## Architecture

The browser communicates with the frontend's Nginx server. Nginx serves the React application and forwards API requests to backend services through an internal Docker network.

```text
                 Browser
                    |
                    v
            Frontend (Nginx)
                    |
          +---------+---------+
          |                   |
          v                   v
     Property Core      Notifications
          |
          v
      PostgreSQL
```

In the standard Docker deployment, PostgreSQL and backend services are not directly exposed to the host. The frontend is the public entry point.

## Getting Started

The recommended way to run the complete application is with Docker Compose.

### Prerequisites

Install:

- [Git](https://git-scm.com/)
- [Docker Engine](https://docs.docker.com/engine/install/) (version 24 or later recommended)
- [Docker Compose v2](https://docs.docker.com/compose/install/)
- OpenSSL for generating secure secrets

Verify your installation:

```bash
docker --version
docker compose version
```

Java, Maven, Node.js, npm, and PostgreSQL do not need to be installed separately when using the Docker deployment.

### 1. Clone the Repository

The repository is public, so cloning does not require a GitHub personal access token.

```bash
git clone https://github.com/zia-ahmadi/property-saas-platform-v2.git

cd property-saas-platform-v2
```

### 2. Configure Environment Variables

Navigate to the deployment directory:

```bash
cd deploy
```

Create your local environment file:

```bash
cp .env.example .env
```

Generate three independent secrets:

```bash
openssl rand -base64 48
openssl rand -base64 32
openssl rand -base64 32
```

Copy the generated values into `deploy/.env`:

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL application password |
| `JWT_SECRET` | JWT signing secret |
| `BROWSER_CSRF_SECRET` | Browser CSRF signing secret |

Both signing secrets must decode to at least 32 bytes. They must be generated independently.

For a standard local setup, keep these configuration values:

```dotenv
POSTGRES_DB=property_management
POSTGRES_USER=property_admin
PUBLIC_ORIGIN=http://localhost:8080
SPRING_PROFILES_ACTIVE=development
FRONTEND_PORT=8080
API_BASE_URL=
```

Save the file.

**Important:** Never commit or publicly share your `.env` file or its secret values.

Return to the repository root:

```bash
cd ..
```

### 3. Start the Application

Navigate to the deployment directory:

```bash
cd deploy
```

Build and start all services:

```bash
docker compose up -d --build
```

Check service status:

```bash
docker compose ps
```

View application logs:

```bash
docker compose logs -f
```

The first startup may take several minutes while Docker downloads images and builds the application containers.

The Compose configuration uses health checks and startup dependencies. PostgreSQL must become healthy before the core backend starts, and the frontend waits for both backend services.

### 4. Open the Application

Open your browser:

**http://localhost:8080**

If you changed `FRONTEND_PORT` in your environment file, use the configured port instead.

## Using the Application

1. Open the application.
2. Register a user and create an organization.
3. Sign in using your registered account.
4. Select your organization when prompted.
5. Access the available features according to your organization role.

### Organization Approval

New organizations are created with a pending status and require platform review before normal organization operations become available.

There are no default platform-owner accounts. An operator must provision a verified account with the `PLATFORM_OWNER` authority. Follow [Platform Administration](backend/property-core/PLATFORM_ADMINISTRATION.md).

### Organization Roles

| Role | General responsibility |
|---|---|
| OWNER | Full organization ownership and management |
| ADMIN | Administrative management |
| MANAGER | Operational management with limited permissions |
| STAFF | Limited operational access |

The backend independently enforces authorization. Frontend controls do not replace server-side security checks.

## Docker Commands

Run these commands from the `deploy/` directory.

| Task | Command |
|---|---|
| Start services | `docker compose up -d` |
| Build and start | `docker compose up -d --build` |
| Check status | `docker compose ps` |
| View all logs | `docker compose logs -f` |
| Core backend logs | `docker compose logs -f property-core` |
| Notifications logs | `docker compose logs -f property-notifications` |
| Frontend logs | `docker compose logs -f frontend` |
| Stop services | `docker compose stop` |
| Remove containers | `docker compose down` |

**Database warning:** `docker compose down` preserves the database volume. Do not use `docker compose down -v` unless you intentionally want to delete the deployment database and all its data.

## Local Development

For development without building application images, follow the detailed instructions in [deploy/README.md](deploy/README.md).

The main development requirements are:

- Node.js 22 and npm for the frontend.
- JDK 21 and the included Maven Wrapper for the backend.
- PostgreSQL.
- Separate JWT and CSRF secrets.
- Correct browser-origin configuration.

The repository also includes a separate development PostgreSQL configuration at `infra/docker-compose.yml`.

The development database and deployment database use separate Docker volumes.

## Testing

### Frontend

Run from `frontend/`:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

### Backend

Run from `backend/property-core/`:

```bash
./mvnw test
```

Backend tests require a reachable PostgreSQL database and suitable test configuration.

### End-to-End QA

The frontend includes a QA runner that uses a disposable PostgreSQL database:

```bash
cd frontend
npm run qa:e2e
```

Do not point disposable QA tests at a production or shared database.

## Project Structure

```text
property-saas-platform-v2/
├── api-contracts/
│   ├── graphql/                 # GraphQL contracts
│   └── rest/                    # OpenAPI specifications
├── backend/
│   ├── property-core/           # Main Spring Boot service
│   └── property-notifications/  # Notification service
├── deploy/
│   ├── .env.example             # Environment template
│   ├── docker-compose.yml       # Full application stack
│   └── README.md                # Deployment documentation
├── docs/                        # Documentation and reports
├── frontend/
│   ├── src/                     # React application
│   ├── Dockerfile
│   └── package.json
├── infra/
│   └── docker-compose.yml       # Development PostgreSQL
└── commands.txt                 # Useful local commands
```

## Configuration

The complete deployment configuration is maintained in [deploy/.env.example](deploy/.env.example).

| Variable | Description |
|---|---|
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | Database username |
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET` | JWT signing secret |
| `BROWSER_CSRF_SECRET` | CSRF signing secret |
| `PUBLIC_ORIGIN` | Allowed browser origin |
| `SPRING_PROFILES_ACTIVE` | Active Spring profile |
| `FRONTEND_PORT` | Public frontend port |
| `API_BASE_URL` | Optional external API origin |

For production, use HTTPS, configure the exact public origin, and do not activate the development Spring profile.

See the [deployment guide](deploy/README.md) for production configuration.

## Security

- Never commit passwords, signing keys, access tokens, or private environment files.
- Generate unique database, JWT, and CSRF secrets.
- Do not use development cookie settings in production.
- Use HTTPS for production deployments.
- Avoid exposing PostgreSQL and backend ports publicly.
- Share invitation links only with their intended recipients.
- Back up PostgreSQL data regularly and protect backup files.

## Documentation

| Document | Description |
|---|---|
| [Deployment Guide](deploy/README.md) | Docker setup, configuration, production deployment, backups, and troubleshooting |
| [Browser Authentication](backend/property-core/BROWSER_AUTH.md) | Cookies, CSRF, origin validation, and sessions |
| [Platform Administration](backend/property-core/PLATFORM_ADMINISTRATION.md) | Platform-owner provisioning, organization review, roles, and invitations |
| [Notification Service](backend/property-notifications/README.md) | GraphQL, notification streams, architecture, and testing |
| [Frontend Authentication](frontend/AUTHENTICATION.md) | Frontend session and organization access |
| [Property Management](frontend/PROPERTY_MANAGEMENT.md) | Property, unit, dashboard, and navigation integration |
| [Frontend Feature Structure](frontend/src/features/README.md) | Frontend feature organization |
| [REST API Contracts](api-contracts/rest/) | OpenAPI specifications |
| [GraphQL Contract](api-contracts/graphql/notifications.graphqls) | Notification GraphQL schema |

## Troubleshooting

| Problem | What to check |
|---|---|
| Required environment variable is missing | Confirm `deploy/.env` exists and contains all required secrets. |
| A container keeps restarting | Inspect logs using `docker compose logs -f <service-name>`. |
| Application does not load | Check container status, frontend logs, and port availability. |
| Login returns 403 | Confirm `PUBLIC_ORIGIN` exactly matches the browser origin, including scheme and port. |
| API requests fail | Confirm backend health and Nginx API proxy configuration. |
| Database connection fails | Check PostgreSQL health and environment credentials. |
| Port 8080 is occupied | Change `FRONTEND_PORT` in `deploy/.env`. |

For additional troubleshooting, see [deploy/README.md](deploy/README.md).

## Contributing

Contributions, bug reports, and improvement suggestions are welcome.

1. Fork the repository.
2. Create a branch for your change.
3. Implement your changes and update relevant tests or documentation.
4. Run the appropriate checks.
5. Submit a pull request describing your changes.

Please do not include secrets, personal data, database dumps, or generated build artifacts in commits.
