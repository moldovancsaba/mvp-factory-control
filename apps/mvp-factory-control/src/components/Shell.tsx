import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { badgeClassName } from "@/components/ui";

export async function Shell(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <div className="ui-shell">
      <header className="ui-shell__header">
        <div className="ui-shell__inner">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="ui-shell__brand">
              <div className="ui-shell__brand-name">
                MVP Factory
                <span className={badgeClassName("accent")}>
                  War Room
                </span>
              </div>
              <div className="ui-shell__brand-copy">
                Control plane for board, agents, telemetry
              </div>
            </Link>
            <nav className="ui-shell__nav">
              <Link className="ui-shell__nav-link" href="/dashboard">
                Dashboard
              </Link>
              <Link className="ui-shell__nav-link" href="/products">
                Products
              </Link>
              <Link className="ui-shell__nav-link" href="/agents">
                Agents
              </Link>
              <Link className="ui-shell__nav-link" href="/chat">
                Chat
              </Link>
              <Link className="ui-shell__nav-link" href="/memory">
                Memory
              </Link>
              <Link className="ui-shell__nav-link" href="/settings">
                Settings
              </Link>
            </nav>
          </div>
          <div className="ui-shell__actions">
            {session?.user?.name ? (
              <div className="ui-shell__user">{session.user.name}</div>
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="ui-page">
        <div className="ui-page__header">
          <div className="ui-page__title">{props.title}</div>
          {props.subtitle ? (
            <div className="ui-page__subtitle">{props.subtitle}</div>
          ) : null}
        </div>
        <div className="ui-page__body">{props.children}</div>
      </main>
    </div>
  );
}
