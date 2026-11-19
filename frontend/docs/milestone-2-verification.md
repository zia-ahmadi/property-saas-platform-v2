# Milestone 2 verification

The F2.8 audit started from a clean working tree at `faa0118`. The scope is the shared design system, application shell, and placeholder routes. The original shadcn color and radius values match the pre-F2 stylesheet in both themes. The Milestone 2 foundation switched typography to system fonts, retained Tailwind spacing and breakpoints, and added the global focus outline.

## Original requirements and evidence

Statuses describe the delivered milestone scope after the audit corrections. PASS means the implementation and supporting evidence are present. PARTIAL means a requirement has an unresolved functional gap. FAIL means the required implementation is absent or unusable.

Source and test paths are relative to `frontend/`.

| #   | Original requirement                                                  | Status | Implementation and evidence                                                                                                                                                                                                                                                                                                                                                                                  | Remaining gap                                                                                                      |
| --- | --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Define color palette, typography, spacing, and responsive breakpoints | PASS   | `src/index.css` maps the original light and dark tokens and defines the system font stack. Tailwind's spacing and breakpoints are documented in [design-system.md](design-system.md). Chrome confirmed the shell transition at 768 px and reflow at five widths.                                                                                                                                             | Forced colors, larger default text, and additional themes or contrast scenarios await manual review.               |
| 2   | Create application layout with sidebar, header, and content area      | PASS   | `src/layouts/AppShell.tsx`, `src/components/layout/AppHeader.tsx`, `AppSidebar.tsx`, and `src/app/router/AppRouter.tsx` provide shared landmarks and an outlet. `src/layouts/AppShell.test.tsx` covers landmarks, route rendering, and the login and fallback behavior.                                                                                                                                      | The shell still displays placeholder product data.                                                                 |
| 3   | Design desktop, tablet, and mobile navigation                         | PASS   | `AppNavigation.tsx`, `AppSidebar.tsx`, and `MobileNavigation.tsx` share destinations. `AppShell.test.tsx` covers active routes, keyboard and pointer dismissal, focus, and the desktop breakpoint change. Chrome exercised the drawer at narrow widths and the sidebar from 768 px. Tablet uses the sidebar at and above that threshold.                                                                     | Physical touch devices and other browser engines were not exercised.                                               |
| 4   | Build reusable buttons, inputs, cards, dialogs, and tables            | PASS   | `src/components/ui/` contains `button.tsx`, `input.tsx`, `textarea.tsx`, `card.tsx`, `confirmation-dialog.tsx`, and `table.tsx`. Card was missing at the baseline and is now covered by `card.test.tsx`. `field.test.tsx`, `confirmation-dialog.test.tsx`, and `table.test.tsx` cover form interaction, dialog behavior, and table semantics. Chrome checked a long card title and keyboard table scrolling. | Existing pages retain their card markup.                                                                           |
| 5   | Create form validation and error-message components                   | PASS   | `field.tsx`, `input.tsx`, `textarea.tsx`, and `label.tsx` expose native labels, required and disabled states, invalid status, and error and description associations. `field.test.tsx` and `src/test/accessibility.test.tsx` cover keyboard interaction and validation presentation. Chrome checked the invalid field relationship and ran axe.                                                              | Live screen-reader delivery remains a manual check. Business rules and submission behavior belong to feature code. |
| 6   | Design loading, empty, success, and error states                      | PASS   | `spinner.tsx`, `skeleton.tsx`, `loading-state.tsx`, `empty-state.tsx`, and `error-state.tsx` provide shared states. `status-badge.tsx` and `use-notification.ts` provide success feedback for durable statuses and transient events. The contract is covered by `feedback-states.test.tsx`, `status-badge.test.tsx`, and `src/app/providers/NotificationProvider.test.tsx`.                                  | Actual announcements still need screen-reader verification.                                                        |
| 7   | Add notifications and confirmation dialogs                            | PASS   | `src/app/providers/NotificationProvider.tsx` mounts one viewport through `src/App.tsx`. `confirmation-dialog.tsx` supplies a controlled modal. `NotificationProvider.test.tsx` and `confirmation-dialog.test.tsx` cover variants, activation, dismissal, pending behavior, and focus restoration. Chrome verified dismissal and return focus for both.                                                       | Check timeout behavior with real assistive technology.                                                             |
| 8   | Implement accessible keyboard navigation and focus states             | PASS   | `AppShell.tsx` provides skip-to-content, `src/index.css` supplies a visible focus indicator, and interactive primitives use native links and buttons or Base UI. `AppShell.test.tsx`, `src/test/accessibility.test.tsx`, and the dialog, notification, table, and page-navigation suites cover keyboard and focus behavior. Chrome verified the selected paths below.                                        | Full WCAG conformance, screen-reader behavior, zoom, and forced colors are outside the verified sample.            |
| 9   | Create reusable page headers, breadcrumbs, and pagination controls    | PASS   | `page-header.tsx`, `breadcrumbs.tsx`, and `pagination.tsx` are covered by `page-navigation.test.tsx`, including exact range and retained focus tests. `src/pages/PropertiesPage.tsx` uses the header, and `PropertyDetailsPage.tsx` uses breadcrumbs. Chrome exercised pagination in a controlled fixture.                                                                                                   | Existing mock lists fit on one page. API-backed pagination belongs to a feature milestone.                         |

## Corrections and form review

- Added a shared Card surface with header, semantic title, description, content, and wrapping footer. The surface uses existing tokens and introduces no landmark or keyboard stop by default. Existing pages were left in place.
- Documented the Card API and default Tailwind breakpoints in [design-system.md](design-system.md).
- Found no functional gap in reusable form validation presentation. Added a regression test that submits a fixture form with the keyboard, verifies the invalid state and described-by relationship, skips a disabled control, then clears the error on input. The application still decides when and how to validate or submit.

## Browser and accessibility results

Headless Chrome 154 measured dashboard, properties, property details, units, settings, login, the unknown-route fallback, and a temporary shared-component fixture at **320, 375, 768, 1024, and 1440 CSS px**. No horizontal overflow was observed in the document or main content. The drawer was available at 320 and 375 px, and the desktop sidebar at 768 px and wider. The deliberately wide table scrolled inside its named container.

At 320 px, keyboard checks covered visible skip-link focus and its destination, drawer and confirmation-dialog focus containment and restoration, form error association, toast dismissal and return focus, numbered pagination and retained focus, and arrow-key table scrolling. Reduced-motion emulation disabled spinner animation and shared button transitions.

Chrome axe scans using WCAG tags reported zero violations for Properties, Property Details, Login, and the fixture in light and dark at 375 px, plus the open mobile drawer, invalid field, and open confirmation dialog at 320 px. The test suite separately uses axe in jsdom for DOM rules. Browser results apply to the tested states and engine. Axe does not establish full WCAG conformance. See [accessibility-audit.md](accessibility-audit.md) for the earlier, complementary F2.6 results.

## Dependencies

`npm ls --depth=0` resolved the installed packages without reporting a top-level compatibility error. The suite uses React 19, TypeScript 6, Vite 8, Vitest 4, jsdom, React Testing Library, and the existing dev-only axe-core. Shared dialogs and toasts reuse Base UI. No duplicate library was introduced for cards or forms. Geist remains installed from the existing setup and is not imported. Shadcn supplies the existing build-time stylesheet and component conventions.

The registry audit reported four moderate package entries in one existing chain, `shadcn@4.23.0 → ts-morph@26.0.0 → @ts-morph/common@0.27.0 → minimatch@10.2.6`. The underlying report is a glob amplification denial-of-service advisory. The tool suggested a major shadcn version change. The manifest and lockfile match `faa0118`, so no audit findings were introduced by this work. Track the existing advisory separately and evaluate remediation against the build and component tooling. [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)

## Validation

All six standard commands passed from `frontend/`.

- `npx tsc -b --force`
- `npm run test` with 138 passing tests across 13 files, including two new Card tests and one new keyboard validation test
- `npm run build`
- `npm run lint`
- `npx prettier --check .`
- `git diff --check`

## Manual checks and readiness

- Verify screen-reader announcements for field errors, loading, success notifications, and pagination gaps with NVDA or VoiceOver.
- Repeat keyboard and reflow checks in Firefox and Safari. Include physical touch input, 200% and 400% zoom, forced colors, larger default text, and long localized labels.
- Exercise dialog and notification focus restoration in those environments, including timed dismissal and the mobile-to-desktop transition.

**Recommendation:** Close Milestone 2 after review of the implementation and test evidence. Keep the manual accessibility checklist and existing dependency advisory open as follow-up items. This is readiness for the milestone's frontend foundation scope.
