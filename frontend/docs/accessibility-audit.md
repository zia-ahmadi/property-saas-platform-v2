# F2.6 accessibility and responsive audit

## Scope and method

The baseline was commit `8550739`. The audit covered the application shell, skip link, desktop and mobile navigation, forms, confirmation dialog, table, feedback states, and notification provider. The current placeholder routes were included where they exposed navigation, reflow, or contrast defects.

Run `npm run test -- src/test/accessibility.test.tsx` from `frontend/` for the focused checks. Axe-core 4.11.2 runs directly against React Testing Library renders in Vitest and jsdom. It has no runtime dependency or React or Vitest peer requirements. The suite scans the shell, login, open mobile drawer, open confirmation dialog, form controls and validation, table, loading and skeleton placeholders, empty and error states, and a visible toast. The existing tests cover required and disabled controls, label and description references, invalid state, error alerts, dialog dismissal, table focus, and toast variants.

The jsdom scan disables the color-contrast rule because jsdom cannot compute rendered contrast. A local headless Chrome 154 run through the Chrome DevTools Protocol checked rendered contrast and layout separately. No browser automation framework was added to the project.

## Findings and corrections

| Finding                                                            | Evidence                                                                                                                                                                  | Correction                                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login labels were disconnected from their controls                 | The email and password inputs had no IDs and their visible labels had no `htmlFor`                                                                                        | Associated the labels, added credential autocomplete hints and a main landmark, and verified required fields and tab order                                                         |
| Property details required a pointer                                | Details navigation was attached to a click handler on a non-focusable card                                                                                                | Added a native details link with a card-wide hit area and kept the separate units action as a named link                                                                           |
| Actions exceeded the main content width                            | At 320 px Chrome measured 103 px of horizontal overflow on properties, 132 px on details, and 47 px on units                                                              | Allowed rows, headings, and metadata to wrap, and reduced narrow-screen card padding                                                                                               |
| Small status text failed light-mode contrast                       | Chrome axe reported 3.65:1 for `#009966` and 3.19:1 for `#e17100` on white, and 4.34:1 for the units ID badge's `#737373` on `#f5f5f5`                                    | Used semantic foreground styling for the dashboard change text, unit status labels, and the units ID badge. Status labels and icons still identify the state                       |
| Input and textarea boundaries were faint                           | On the form background, the original input border measured 1.26:1 in light mode (`oklch(0.922 0 0)` on white) and 1.47:1 in dark mode (15% white over `oklch(0.145 0 0)`) | Used the existing muted foreground token on normal form boundaries, measuring about 4.74:1 light and 7.66:1 dark. Invalid borders and the keyboard focus indicator remain distinct |
| Escape could leave focus on the page body after dismissing a toast | Reproduced when focus entered the toast without using Base UI's F6 shortcut                                                                                               | Restored the prior control when focus would otherwise fall away. Existing Base UI focus handling still takes priority when it moves focus                                          |
| Shared buttons applied transitions under reduced motion            | The transition and active offset utilities were unconditional                                                                                                             | Gated button transitions and active movement on the motion preference                                                                                                              |

All palette values and route paths remain in place.

## Browser results

Chrome checked dashboard, properties, property details, units, settings, login, and the unknown-route fallback at 320, 375, 768, 1024, and 1440 CSS pixels. The shell showed mobile navigation at 320 and 375, and the sidebar at 768, 1024, and 1440. The sampled pages showed no document or main-content horizontal overflow after correction. Header titles and sampled controls stayed within their horizontal bounds. Light and dark axe WCAG-tag scans at 375 px found no violations on the six named routes. A shared-component fixture also passed the scanned checks with the confirmation dialog or toast open in light mode and in its default dark state. The open mobile drawer also passed the scanned checks.

At 320 px, Chrome verified the skip link's focus indicator and destination, mobile drawer keyboard operation and focus restoration, confirmation dialog fit and focus containment, arrow-key scrolling within a wide table, and toast dismissal and focus restoration. With reduced motion emulated, the spinner stopped animating and the shared button transition was disabled. Chrome also verified that the drawer and toast remained static under reduced motion. Code review confirmed that the confirmation popup and skeleton have no entry or exit animations.

## Manual browser and screen-reader checklist

- Repeat the five widths in Firefox and Safari. Check wrapping, actions, dialog and drawer controls, and horizontal scroll at 200% and 400% zoom and with larger default text.
- In light, dark, and forced-colors modes, tab through the shell and verify the focus indicator stays visible, including when controls sit near a scroll container's edge.
- With NVDA or VoiceOver, verify heading and landmark navigation, current-page links, credential labels, required and invalid fields, and announcement of a new validation error.
- Open and dismiss the drawer and confirmation dialog using the keyboard. Verify the dialog name, description, focus containment, and return focus. Test a long dialog and reach its actions by scrolling at 320 px.
- Focus a named table region, scroll horizontally with the keyboard, and verify the caption and header associations in screen-reader table navigation.
- Confirm that loading, retry progress, and newly added notifications announce when expected without moving focus. Test notification close, Escape, and F6, and confirm the user's current task remains reachable after dismissal.
- Enable reduced motion in the operating system, then exercise the spinner, navigation, dialogs, buttons, and notifications.

The browser run used one desktop Chrome engine and sampled content. Screen-reader speech, forced colors, zoom, touch interaction, long localized text, and other browsers still need manual verification. Automated checks cover detectable issues in the tested states and do not establish WCAG conformance.
