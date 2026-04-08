import { cn } from "@/lib/cn";

export function buttonClassName(tone: "default" | "secondary" | "success" | "danger" = "default") {
  return cn(
    "ui-button",
    tone === "secondary" && "ui-button--secondary",
    tone === "success" && "ui-button--success",
    tone === "danger" && "ui-button--danger"
  );
}

export function badgeClassName(tone: "default" | "accent" | "success" | "warning" | "danger" = "default") {
  return cn(
    "ui-badge",
    tone === "accent" && "ui-badge--accent",
    tone === "success" && "ui-badge--success",
    tone === "warning" && "ui-badge--warning",
    tone === "danger" && "ui-badge--danger"
  );
}
