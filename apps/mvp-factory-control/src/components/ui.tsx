/**
 * Design-token class helpers for buttons and badges (see `docs/design-system-lts.md` and
 * `src/app/globals.css` for `.ui-button` / `.ui-badge` rules). Prefer these over ad-hoc Tailwind in
 * TSX so surfaces stay consistent.
 */
//> Import bindings from a module.
import { cn } from "@/lib/cn";

/** Maps a semantic tone to `ui-button` modifier classes. */
//> Export declaration.
export function buttonClassName(tone: "default" | "secondary" | "success" | "danger" = "default") {
  //> Return a value.
  return cn(
    //> String literal line.
    "ui-button",
    //> Source statement or expression.
    tone === "secondary" && "ui-button--secondary",
    //> Source statement or expression.
    tone === "success" && "ui-button--success",
    //> Source statement or expression.
    tone === "danger" && "ui-button--danger"
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

/** Maps a semantic tone to `ui-badge` modifier classes. */
//> Export declaration.
export function badgeClassName(tone: "default" | "accent" | "success" | "warning" | "danger" = "default") {
  //> Return a value.
  return cn(
    //> String literal line.
    "ui-badge",
    //> Source statement or expression.
    tone === "accent" && "ui-badge--accent",
    //> Source statement or expression.
    tone === "success" && "ui-badge--success",
    //> Source statement or expression.
    tone === "warning" && "ui-badge--warning",
    //> Source statement or expression.
    tone === "danger" && "ui-badge--danger"
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}
