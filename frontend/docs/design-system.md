# Design system foundation

## Principles

Preserve the original shadcn neutral palette, its red destructive color, and its blue dark-sidebar primary. Use semantic names instead of page-specific colors. Keep shared primitives consistent. Color supports meaning; labels and interaction states must communicate it too. This foundation adds no shell, theme toggle, or business functionality.

## Semantic colors

`src/index.css` is the source of truth. Tailwind v4's `@theme inline` maps variables to matching utilities such as `bg-card`, `text-card-foreground`, `border-input`, and `ring-ring`. Light and dark values match the original Git HEAD palette; sidebar values remain explicit because the dark sidebar primary intentionally differs from the main primary.

| Token                        | Light                       | Dark                         |
| ---------------------------- | --------------------------- | ---------------------------- |
| `background`                 | `oklch(1 0 0)`              | `oklch(0.145 0 0)`           |
| `foreground`                 | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`           |
| `card`                       | `oklch(1 0 0)`              | `oklch(0.205 0 0)`           |
| `card-foreground`            | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`           |
| `popover`                    | `oklch(1 0 0)`              | `oklch(0.205 0 0)`           |
| `popover-foreground`         | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`           |
| `primary`                    | `oklch(0.205 0 0)`          | `oklch(0.922 0 0)`           |
| `primary-foreground`         | `oklch(0.985 0 0)`          | `oklch(0.205 0 0)`           |
| `secondary`                  | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`           |
| `secondary-foreground`       | `oklch(0.205 0 0)`          | `oklch(0.985 0 0)`           |
| `muted`                      | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`           |
| `muted-foreground`           | `oklch(0.556 0 0)`          | `oklch(0.708 0 0)`           |
| `accent`                     | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`           |
| `accent-foreground`          | `oklch(0.205 0 0)`          | `oklch(0.985 0 0)`           |
| `destructive`                | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)`  |
| `border`                     | `oklch(0.922 0 0)`          | `oklch(1 0 0 / 10%)`         |
| `input`                      | `oklch(0.922 0 0)`          | `oklch(1 0 0 / 15%)`         |
| `ring`                       | `oklch(0.708 0 0)`          | `oklch(0.556 0 0)`           |
| `chart-1`                    | `oklch(0.87 0 0)`           | `oklch(0.87 0 0)`            |
| `chart-2`                    | `oklch(0.556 0 0)`          | `oklch(0.556 0 0)`           |
| `chart-3`                    | `oklch(0.439 0 0)`          | `oklch(0.439 0 0)`           |
| `chart-4`                    | `oklch(0.371 0 0)`          | `oklch(0.371 0 0)`           |
| `chart-5`                    | `oklch(0.269 0 0)`          | `oklch(0.269 0 0)`           |
| `sidebar`                    | `oklch(0.985 0 0)`          | `oklch(0.205 0 0)`           |
| `sidebar-foreground`         | `oklch(0.145 0 0)`          | `oklch(0.985 0 0)`           |
| `sidebar-primary`            | `oklch(0.205 0 0)`          | `oklch(0.488 0.243 264.376)` |
| `sidebar-primary-foreground` | `oklch(0.985 0 0)`          | `oklch(0.985 0 0)`           |
| `sidebar-accent`             | `oklch(0.97 0 0)`           | `oklch(0.269 0 0)`           |
| `sidebar-accent-foreground`  | `oklch(0.205 0 0)`          | `oklch(0.985 0 0)`           |
| `sidebar-border`             | `oklch(0.922 0 0)`          | `oklch(1 0 0 / 10%)`         |
| `sidebar-ring`               | `oklch(0.708 0 0)`          | `oklch(0.556 0 0)`           |

Pair surfaces with their corresponding foreground tokens. Use `primary` for actions, `secondary` for supporting controls, `muted` for low-emphasis surfaces and text, and `accent` for highlighted surfaces. `destructive` is red foreground for existing tinted destructive controls, not a background/foreground pair. `border` is a subtle separator; `input` retains the original subtle control-boundary color, including its transparency in dark mode. `ring` indicates focus. Chart tokens provide the original five grayscale shades; they do not encode business statuses.

## Typography

The sans and heading stack is `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'`. Fonts come from the operating system, without font downloads. The existing Geist package remains installed but is no longer imported.

Body text uses `text-base leading-relaxed` (1rem, line height 1.625). The root font size remains the browser default, respecting user preferences. Use semantic heading elements and existing Tailwind sizes: page headings currently use `text-2xl font-bold tracking-tight`, section headings `text-base font-semibold`, and supporting copy `text-sm text-muted-foreground`. No global heading-size override is added.

## Spacing

Retain Tailwind's default scale (`--spacing: 0.25rem`). Use `gap-*`, `p-*`, `m-*`, and `space-*`: 2 = 0.5rem, 4 = 1rem, 6 = 1.5rem, 8 = 2rem. No custom spacing utilities are introduced.

## Responsive breakpoints

Use Tailwind's mobile-first defaults. Unprefixed utilities apply at all widths, and responsive prefixes apply from their minimum widths upward.

| Prefix | Minimum | Equivalent at a 16 px default |
| ------ | ------- | ----------------------------- |
| `sm`   | 40rem   | 640px                         |
| `md`   | 48rem   | 768px                         |
| `lg`   | 64rem   | 1024px                        |
| `xl`   | 80rem   | 1280px                        |
| `2xl`  | 96rem   | 1536px                        |

The application shell uses the navigation drawer below `md` and the desktop sidebar from `md` upward. Let flexible content wrap and keep horizontal scrolling local to containers such as wide tables.

## Border radius

`--radius` remains 0.625rem in both themes. Existing mappings: `rounded-sm` 0.375rem, `rounded-md` 0.5rem, `rounded-lg` 0.625rem, `rounded-xl` 0.875rem, `rounded-2xl` 1.125rem, `rounded-3xl` 1.375rem, `rounded-4xl` 1.625rem. Prefer smaller radii for controls and larger ones for surfaces. `rounded-full` remains available for pills.

## Light and dark conventions

`:root` supplies light values. Put `.dark` on `<html>` to activate dark tokens and existing Tailwind `dark:` variants. `color-scheme: light` / `dark` aligns native controls with the chosen theme. There is no system-preference detection, persistence, or toggle. Prefer semantic utilities that adapt automatically over duplicated dark color classes.

## Accessibility

Aim for at least 4.5:1 contrast for normal text and 3:1 for large text and meaningful control boundaries. Preserving the original palette is not a guarantee that every token pairing or component state meets these targets. Check actual composited colors when applying opacity, hover treatments, or tinted destructive surfaces; token values alone cannot validate all component states.

The global `:focus-visible` rule adds a solid 2px `foreground` outline with 2px offset, including on primitives that reset native outlines. The high-contrast neutral foreground keeps the outline distinct on the main surfaces without changing the original ring palette. Existing component rings remain. Keep indicators visible and avoid clipping them. The original `border` and `input` tokens are subtle and do not by themselves guarantee 3:1 control-boundary contrast. Evaluate each control on its actual surface and supply sufficient visual identification when needed. Use text or icons alongside status/error colors. Charts need labels, patterns, or other differentiation; series colors alone do not guarantee accessible adjacent contrast. Check keyboard navigation, zoom, forced colors, and both themes as components are built.

## Consuming tokens

```tsx
<section className="rounded-xl border border-border bg-card p-6 text-card-foreground">
  <h2 className="text-base font-semibold">Section title</h2>
  <p className="text-sm text-muted-foreground">Supporting information</p>
</section>
```

Use existing Button and Badge variants. Prefer `bg-primary text-primary-foreground` to hard-coded colors. `font-heading` uses the shared font stack. Add future semantic tokens to the existing theme blocks and map them once in `@theme inline`; avoid parallel palettes or page-local token definitions. Existing placeholder layouts and status-color classes are preserved and still need component-level accessibility review.

## Shared UI components

Shared primitives live in `src/components/ui/`. They provide presentation, native semantics, and basic interactions; features own domain labels, validation rules, API calls, pending state, and data transformations. Existing pages have not been migrated as part of this addition.

### Cards

Use `Card` for a bordered surface with the existing `card` and `card-foreground` tokens. Compose optional `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter` as needed. Each part forwards native element props, refs, and custom classes. `CardTitle` defaults to an `h2` and accepts `headingLevel={3}` or `headingLevel={4}` for nested content. The surface adds no landmark or tab stop. Put native links or buttons inside it for interactions. The footer wraps actions at narrow widths.

```tsx
<Card>
  <CardHeader>
    <CardTitle headingLevel={3}>Record summary</CardTitle>
    <CardDescription>Review recent changes.</CardDescription>
  </CardHeader>
  <CardContent>Two changes available.</CardContent>
  <CardFooter>
    <Button onClick={onReview}>Review changes</Button>
  </CardFooter>
</Card>
```

### Forms

`Label`, `Input`, and `Textarea` forward native element props, including React 19 refs, `required`, `disabled`, `value`, `defaultValue`, `aria-invalid`, and `aria-describedby`. Inputs default to text. Textareas retain native multiline behavior and vertical resizing. Both use the existing `muted-foreground` token for a higher-contrast boundary and the global keyboard-focus outline.

`Field` renders a label, optional description, control, and optional error. Its render function supplies a stable unique control ID, `required`, `disabled`, `aria-invalid`, and description/error IDs. Spread these props onto one input or textarea. `id` on Field selects the control's ID; it is not applied to the wrapper. A visible “(required)” suffix accompanies the native required attribute. Errors use `role="alert"`; features decide when validation runs and supply concise error text.

```tsx
<Field label="Display name" description="Shown to your team." required error={nameError}>
  {(controlProps) => (
    <Input {...controlProps} value={name} onChange={(event) => setName(event.target.value)} />
  )}
</Field>
```

For standalone controls, associate `Label` through `htmlFor` and the control's `id`. If adding external description IDs to a Field control, merge them with the supplied `aria-describedby`; do not replace it. There is no form state or validation library in these wrappers.

### Confirmation dialogs

`ConfirmationDialog` uses the installed Base UI Dialog with the shared Button. Supply a button element as `trigger`, controlled `open` / `onOpenChange`, a title, a description, and `onConfirm`. Customize action text with `confirmLabel` / `cancelLabel`. For irreversible actions, use `destructive`, an explicit action label, and a description of the consequence.

The modal traps focus, blocks background interaction, and initially focuses Cancel. Cancel, Escape, and outside presses dismiss through Base UI; focus returns to the trigger according to its standard behavior. `onCancel` runs only for the explicit cancel button. `onConfirm` does not automatically close the dialog: the owner handles work, errors, and successful dismissal. `loading` disables confirmation, exposes `aria-busy`, and displays `loadingLabel` (default “Confirming…”); `confirmDisabled` disables it independently. During loading, Cancel is disabled and Base UI close requests (including Escape and outside presses) are blocked. The owner can still close the dialog by updating `open`, for example after work finishes. When initially opened while loading, focus falls back to the dialog because both actions are disabled. The component adds no animation or artificial asynchronous operation.

### Tables

Compose `TableContainer`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, and optional `TableCaption`. They render native table elements. `TableHead` defaults to `scope="col"`; set `scope="row"` for row headers. Name the table with a caption or `aria-label` / `aria-labelledby`.

`TableContainer` is a keyboard-focusable horizontal scroll region; its TypeScript props require an accessible name through `aria-label` or `aria-labelledby`. Supply non-empty text or IDs of existing elements with meaningful text; normal div props and refs remain supported. Keep it inside a `min-w-0` flexible parent so wide content scrolls within the container. Width requirements belong to the consuming feature. Do not put unrelated interactive widgets inside table headings to simulate sorting. Sorting, pagination, filters, empty/loading states, and data access belong to features.

### Status badges

`StatusBadge` reuses Badge, accepts `tone="neutral" | "success" | "warning" | "destructive"`, and requires a text label as children. Neutral, success, and warning deliberately share the existing `secondary` colors, with circle, check-circle, and warning-triangle icons respectively. Destructive uses the existing destructive variant and alert-circle icon. Icons are decorative; meaningful text must identify the status. No green/amber palette or global color variables are added.

Features map their domain states to these generic tones and labels. Static badges are not live regions by default. Add `role="status"` only when a changing status needs polite announcement; do not make every table badge a live region. Badge's existing composition props remain available, but a custom `render` element must preserve the provided text and semantics.

### Feedback states

Use `Spinner` for a compact indicator and `LoadingState` while a section or collection has no content to show. Both accept a `label` and announce it through a polite status region. Spinner text is visually hidden by default, and its icon spins only when the user allows motion. `LoadingState` shows the label and keeps it outside its busy placeholder region. `Skeleton` is decorative and static. Set its dimensions with classes and use it inside a loading state or an existing region that already announces loading. For background refreshes, keep the displayed content in place and use `aria-busy` on the region being updated when appropriate.

Use `EmptyState` after a successful request returns no content. Supply a title and description and optionally provide a decorative icon and an action. Use `ErrorState` when a section cannot display its content. Its polite announcement includes the title and user-facing description. Use the safe default description or supply authored copy. Keep exceptions, stack traces, server messages, credentials, and response bodies out of user-facing strings. The caller owns retry and passes `retrying` or `retryDisabled` to prevent repeated activation.

```tsx
<LoadingState
  label="Loading results…"
  placeholder={<Skeleton className="h-20 w-full" />}
/>

<EmptyState
  title="No results"
  description="Try adjusting your filters."
  action={<Button onClick={clearFilters}>Clear filters</Button>}
/>

<ErrorState
  title="Results unavailable"
  description="Check your connection and try again."
  onRetry={retry}
  retrying={isRetrying}
/>
```

Use `useNotification` for brief feedback about an event, such as completing an action. Prefer an inline error or empty state when the message explains the current screen or the user needs it to continue. The single root `NotificationProvider` supplies the notification viewport. Call `notify` from a component inside it and pass a `variant` of `success`, `error`, `warning`, or `info`. Supply a short title and optional safe description. The returned ID can be passed to `dismiss(id)`.

```tsx
const { notify } = useNotification()

function handleSaved() {
  notify({ variant: 'success', title: 'Changes saved' })
}
```

Notifications use polite announcements, stay out of the way of the current focus, and provide a labeled close button. Escape dismisses a focused toast. Base UI pauses timed dismissal during hover or keyboard focus. Success and informational messages time out after eight seconds, while warnings and errors require dismissal. The viewport shows the three newest toasts. Older active toasts can reappear when space becomes available, so put essential information inline. Toasts use semantic colors, distinct icons, and accessible variant labels without animation.

### Page headers and breadcrumbs

`PageHeader` takes a `title`, an optional `description`, and optional `actions` and `breadcrumbs` slots. It uses an `h1` by default. Use `headingLevel={2}` when the application shell already supplies the top-level heading. Long titles wrap, and actions can flow onto their own row on narrow screens.

`Breadcrumbs` takes `ancestors` as ordered `{ label, to }` items and a `current` label. Each destination accepts React Router's `To` type. Supply labels and paths from the page's own context. The component renders a named navigation landmark and ordered list. Ancestor links work with the keyboard, the current item is marked with `aria-current="page"`, and decorative chevrons are hidden from assistive technology. Labels wrap without clipping.

```tsx
<PageHeader
  headingLevel={2}
  title="Property Details"
  description="Review the property record."
  breadcrumbs={
    <Breadcrumbs
      ancestors={[{ label: 'Properties', to: '/properties' }]}
      current="Property Details"
    />
  }
  actions={<Button onClick={openEditor}>Edit property</Button>}
/>
```

### Pagination

`Pagination` takes a controlled, **one-based** `page`, a `totalPages` count, and an `onPageChange` callback. Use the optional `label` to distinguish multiple pagination landmarks. The caller owns the selected page and the data it displays. For zero or one page, or invalid numeric inputs, the component renders no controls. Current-page and out-of-range selections do not call the callback.

Previous and Next are disabled at their respective boundaries. Numbered buttons have explicit page names and the current one has `aria-current="page"`. For larger totals, the first, last, and nearby pages stay visible. Ellipses are static and have the screen-reader text “Pages omitted.” Controls use the shared button focus styles and wrap onto additional rows on narrow screens.

```tsx
const [page, setPage] = useState(1)

<Pagination
  page={page}
  totalPages={12}
  onPageChange={setPage}
  label="Property results pagination"
/>
```
