//> String literal line.
"use client";

/** Client button invoking NextAuth `signOut()` (used in `Shell`). */
//> Import bindings from a module.
import { signOut } from "next-auth/react";
//> Import bindings from a module.
import { buttonClassName } from "@/components/ui";

//> Export declaration.
export function SignOutButton() {
  //> Return a value.
  return (
    <button
      type="button"
      className={buttonClassName("secondary")}
      onClick={() => signOut()}
    >
      Sign out
    </button>
  );
//> Brace or statement terminator.
}
