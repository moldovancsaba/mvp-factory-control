/**
 * Class name helper: filters falsy entries and joins with a space.
 * Used by UI primitives in `components/ui.tsx` and pages that compose Tailwind-style tokens.
 */
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
