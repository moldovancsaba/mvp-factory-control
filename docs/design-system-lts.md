# MVP Factory Control Design System

Date: 2026-04-06
Status: LTS baseline

## Purpose

This design system exists so UI changes can be made from the system layer instead of screen-by-screen edits.

**Code references:** `apps/mvp-factory-control/src/app/globals.css` (tokens and layout classes), `apps/mvp-factory-control/src/components/ui.tsx` (`buttonClassName`, `badgeClassName`), and `src/components/Shell.tsx` (chrome). Each file’s top comment summarizes its contract with this document.

## Principles

1. Layout before ornament.
2. One semantic primitive per repeated pattern.
3. Tones are semantic: default, accent, success, warning, danger.
4. Pages compose from shell, header, panels, grids, forms, and actions.
5. Page files should describe intent, not paint pixels.

## Layout Grammar

### Width

- App pages use a shared content width through `.ui-page`
- Auth pages use `.ui-auth` and `.ui-auth__content`
- No page-local `max-w-*` unless there is a product requirement

### Vertical rhythm

- Large section stacks: `.ui-stack-lg`
- Standard section stacks: `.ui-stack-md`
- Tight grouping: `.ui-stack-sm`

### Responsive grids

- Two-column content: `.ui-grid-2`
- Three-up summaries: `.ui-grid-3`
- KPI or auto-fit summaries: `.ui-grid-4`, `.ui-grid-auto`

## Surface Primitives

- `.ui-panel`: primary container
- `.ui-panel--compact`: reduced padding
- `.ui-panel--hero`: emphasized surface
- `.ui-subpanel`: nested or supporting surface
- `.ui-list-panel`: list wrapper
- `.ui-list-row`: clickable list row
- `.ui-empty`: empty/error/helper state

## Typography Primitives

- `.ui-page__title`
- `.ui-page__subtitle`
- `.ui-section-title`
- `.ui-copy`
- `.ui-meta`
- `.ui-kicker`

## Action Primitives

- `.ui-button`
- `.ui-button--secondary`
- `.ui-button--success`
- `.ui-button--danger`

Use `buttonClassName()` in [`ui.tsx`](/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src/components/ui.tsx) for JS/TS usage.

## Status Primitives

- `.ui-badge`
- `.ui-badge--accent`
- `.ui-badge--success`
- `.ui-badge--warning`
- `.ui-badge--danger`

Use `badgeClassName()` in [`ui.tsx`](/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src/components/ui.tsx) for JS/TS usage.

## Form Primitives

- `.ui-field`
- `.ui-field__label`
- `.ui-input`
- `.ui-select`
- `.ui-textarea`

## Usage Rules

- Prefer semantic classes over raw Tailwind strings for repeated patterns.
- If a pattern appears in 2+ places, move it into the system layer.
- If a design change touches more than one page, implement it in the primitive, not in each screen.
- Keep page code focused on information architecture and behavior.

## Fast Change Surface

The main files to edit for global design changes are:
- [`globals.css`](/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src/app/globals.css)
- [`Shell.tsx`](/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src/components/Shell.tsx)
- [`ui.tsx`](/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src/components/ui.tsx)

That is the intended LTS contract.
