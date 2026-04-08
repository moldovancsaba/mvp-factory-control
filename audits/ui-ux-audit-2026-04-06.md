# UI/UX Audit

Date: 2026-04-06
Scope: `/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src`

## Executive Summary

The app had a recognizable visual flavor, but not a true design system.

What existed:
- A shared dark atmospheric theme in [`globals.css`](/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src/app/globals.css)
- A shared app shell in [`Shell.tsx`](/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src/components/Shell.tsx)
- Repeated card, badge, button, and form patterns across pages

What was missing:
- Stable layout grammar
- Reusable semantic primitives for panels, lists, forms, and actions
- Standard width and spacing rules
- Standardized responsive grid behavior
- One source of truth for state/tone styling

## Audit Findings

### 1. Layout grammar was implicit, not defined

Symptoms:
- Shared shell width and page-level content width were not formally documented
- Sign-in used a separate composition model from the authenticated app
- Pages mixed `space-y-*`, `mt-*`, and grid spacing without a shared rhythm

Impact:
- New screens would almost certainly drift
- Small layout changes required page-by-page patching

### 2. Most components were semantic duplicates with slightly different classes

Examples:
- Panels: repeated `rounded-2xl border border-white/12 bg-white/5 p-*`
- Subpanels: repeated black-tinted rounded containers
- Buttons: multiple near-identical primary/secondary/danger treatments
- Inputs/selects/textareas: same control expressed many times with small variations
- Pills/badges: many one-off tone combinations

Impact:
- Maintenance cost was high
- Visual regressions were easy to introduce
- Future redesign work would be slow

### 3. Responsiveness was inconsistent

Symptoms:
- Different screens chose different breakpoints and column rules ad hoc
- Dense management screens relied on local grid decisions instead of shared responsive patterns

Impact:
- Uneven behavior across device widths
- Harder QA surface for every future page

### 4. Styling intent lived in implementation details

Symptoms:
- Tone decisions were encoded as raw color classes in page files
- Components expressed visual styling directly instead of using semantic names like `warning`, `danger`, `accent`

Impact:
- Fast local delivery, poor long-term leverage
- No safe “change once, update everywhere” path

## Comparison To The New LTS System

The new system formalizes the app into:
- Page shell
- Page header
- Stack spacing
- Responsive grid presets
- Primary panel
- Secondary subpanel
- List panel and list row
- Empty state
- Button variants
- Badge variants
- Form controls
- Auth layout

This turns the previous visual language into named primitives instead of repeated class strings.

## Refactor Direction Applied

Implemented foundations:
- Tokenized surface, text, border, spacing, radius, and width rules in [`globals.css`](/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src/app/globals.css)
- Standard shell and page header structure in [`Shell.tsx`](/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src/components/Shell.tsx)
- Reusable tone helpers in [`ui.tsx`](/Users/Shared/Projects/mvp-factory-control/apps/mvp-factory-control/src/components/ui.tsx)

Applied to app surfaces:
- Dashboard
- Products index
- Product detail
- Chat
- Settings
- Sign-in flow

Partially normalized on larger management/detail screens:
- Agents
- Issue detail

## Recommended Rule Going Forward

No new page should introduce raw one-off layout primitives unless the pattern is being added to the system layer first.
