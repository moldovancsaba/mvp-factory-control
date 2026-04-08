/**
 * Sign-in page: redirects authenticated users to `/dashboard`; renders `SignInCard` with provider flags from env.
 */
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInCard } from "@/components/SignInCard";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard");

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  const devEnabled = Boolean(process.env.MVP_FACTORY_CONTROL_DEV_LOGIN_PASSWORD);

  return (
    <div className="ui-auth">
      <div className="ui-auth__content ui-stack-lg">
        <div className="ui-page__header">
          <div className="ui-page__title">MVP Factory War Room</div>
          <div className="ui-page__subtitle">
            Sign in to access private dashboards, chat, and control surfaces.
          </div>
        </div>
        <SignInCard googleEnabled={googleEnabled} devEnabled={devEnabled} />
        <div className="ui-meta">
          This instance is local-first. Google auth is only used for access
          control and SSO entry.
        </div>
      </div>
    </div>
  );
}
