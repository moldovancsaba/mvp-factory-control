/**
 * Class name helper: filters falsy entries and joins with a space.
 * Used by UI primitives in `components/ui.tsx` and pages that compose Tailwind-style tokens.
 */
//> Export declaration.
export function cn(...values: Array<string | false | null | undefined>) {
  //> Return a value.
  return values.filter(Boolean).join(" ");
//> Brace or statement terminator.
}
