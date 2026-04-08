/**
 * Design-token class helpers for buttons and badges (see `docs/design-system-lts.md` and
 * `src/app/globals.css` for `.ui-button` / `.ui-badge` rules). Prefer these over ad-hoc Tailwind in
 * TSX so surfaces stay consistent.
 */
import { cn } from "@/lib/cn";

/** Maps a semantic tone to `ui-button` modifier classes. */
export function buttonClassName(tone: "default" | "secondary" | "success" | "danger" = "default") {
  return cn(
    "ui-button",
    tone === "secondary" && "ui-button--secondary",
    tone === "success" && "ui-button--success",
    tone === "danger" && "ui-button--danger"
  );
}

/** Maps a semantic tone to `ui-badge` modifier classes. */
export function badgeClassName(tone: "default" | "accent" | "success" | "warning" | "danger" = "default") {
  return cn(
    "ui-badge",
    tone === "accent" && "ui-badge--accent",
    tone === "success" && "ui-badge--success",
    tone === "warning" && "ui-badge--warning",
    tone === "danger" && "ui-badge--danger"
  );
}
