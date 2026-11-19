# Frontend features

Feature folders group code by product area so a change to one area can usually be made in one place. Route-level pages in `src/pages/` compose feature code, and application layouts live in `src/layouts/`.

## Feature folders

- `api/` holds feature-specific request functions built on the shared HTTP client.
- `components/` holds UI tied to the feature's workflows and data.
- `hooks/` holds reusable feature behavior, including TanStack Query hooks that call the feature's request functions.
- `types/` holds types used across modules within the feature, such as domain models and request and response shapes.

## Shared code and imports

Keep reusable UI primitives in `src/components/ui/`, the HTTP client and its error type in `src/lib/api/`, and environment configuration in `src/config/`. Application-wide providers and route definitions belong in `src/app/providers/` and `src/app/router/`.

Use relative imports within a feature and the `@/` alias for imports from elsewhere in `src/`. Use `import type` for type-only dependencies. Pages can compose multiple features, and shared modules stay independent of feature modules.

Prefer composing features in a page or passing data through props. When a direct feature dependency is necessary, import from an entry point the owning feature exposes and keep the dependency one-way. If two features need the same neutral code, move that code to an appropriate shared directory to avoid a cycle.

## Adding a feature

Create a folder under `src/features/` using lowercase kebab-case. Add the subfolders the feature needs and put each module in the folder that matches its responsibility. Keep a `.gitkeep` only while a folder is empty. If the feature needs a route, compose its UI in `src/pages/` and register the route in `src/app/router/`.
