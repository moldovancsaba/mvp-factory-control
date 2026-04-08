/**
 * Sign-in page: redirects authenticated users to `/dashboard`; renders `SignInCard` with provider flags from env.
 */
//> Import bindings from a module.
import { getServerSession } from "next-auth";
//> Import bindings from a module.
import { redirect } from "next/navigation";
//> Import bindings from a module.
import { authOptions } from "@/lib/auth";
//> Import bindings from a module.
import { SignInCard } from "@/components/SignInCard";

//> Export declaration.
export default async function SignInPage() {
  //> Variable declaration.
  const session = await getServerSession(authOptions);
  //> Conditional branch.
  if (session?.user) redirect("/dashboard");

  //> Variable declaration.
  const googleEnabled = Boolean(
    //> Source statement or expression.
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const devEnabled = Boolean(process.env.MVP_FACTORY_CONTROL_DEV_LOGIN_PASSWORD);

  //> Return a value.
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
//> Brace or statement terminator.
}
