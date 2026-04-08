/**
 * Landing route (`/`): immediately redirects to `/dashboard` (no standalone home UI).
 */
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}

