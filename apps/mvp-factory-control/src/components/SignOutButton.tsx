"use client";

/** Client button invoking NextAuth `signOut()` (used in `Shell`). */
import { signOut } from "next-auth/react";
import { buttonClassName } from "@/components/ui";

export function SignOutButton() {
  return (
    <button
      type="button"
      className={buttonClassName("secondary")}
      onClick={() => signOut()}
    >
      Sign out
    </button>
  );
}
