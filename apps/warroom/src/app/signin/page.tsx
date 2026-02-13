import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInCard } from "@/components/SignInCard";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard");

  const githubEnabled = Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  );
  const devEnabled = Boolean(process.env.WARROOM_DEV_LOGIN_PASSWORD);

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <div className="text-3xl font-semibold">MVP Factory War Room</div>
          <div className="mt-2 text-sm text-white/70">
            Sign in to access private dashboards, chat, and control surfaces.
          </div>
        </div>
        <SignInCard githubEnabled={githubEnabled} devEnabled={devEnabled} />
        <div className="mt-8 text-xs text-white/55">
          This instance is local-first. GitHub auth is only used for access
          control and optional GitHub API calls.
        </div>
      </div>
    </div>
  );
}
