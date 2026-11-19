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
