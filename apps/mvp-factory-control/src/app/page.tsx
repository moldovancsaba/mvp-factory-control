/**
 * Landing route (`/`): immediately redirects to `/dashboard` (no standalone home UI).
 */
//> Import bindings from a module.
import { redirect } from "next/navigation";

//> Export declaration.
export default function HomePage() {
  //> Source statement or expression.
  redirect("/dashboard");
//> Brace or statement terminator.
}

