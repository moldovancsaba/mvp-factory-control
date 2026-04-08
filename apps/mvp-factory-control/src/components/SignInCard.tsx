//> String literal line.
"use client";

/**
 * Sign-in **card** for `/signin`: Google OAuth and/or dev credentials based on props from server page.
 */
//> Import bindings from a module.
import { signIn } from "next-auth/react";
//> Import bindings from a module.
import { buttonClassName } from "@/components/ui";

//> Export declaration.
export function SignInCard(props: { googleEnabled: boolean; devEnabled: boolean }) {
  //> Return a value.
  return (
    <div className="ui-panel ui-panel--hero ui-stack-md">
      <div className="ui-kicker">Authentication</div>

      {props.googleEnabled ? (
        <>
          <div className="ui-section-title">Google</div>
          <div className="ui-copy">
            Recommended. Use your Google account to enter the private SSO surface.
          </div>
          <button
            type="button"
            className={`${buttonClassName()} w-full`}
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Continue with Google
          </button>
        </>
      ) : null}

      {props.devEnabled ? (
        <>
          <div className={props.googleEnabled ? "pt-3" : ""} />
          <div className="ui-section-title">Dev Login</div>
          <div className="ui-copy">
            Enabled because `MVP_FACTORY_CONTROL_DEV_LOGIN_PASSWORD` is set. Use this only on your
            local machine.
          </div>
          <button
            type="button"
            className={`${buttonClassName("secondary")} w-full`}
            onClick={() => signIn("mvp-factory-control-dev", { callbackUrl: "/dashboard" })}
          >
            Continue with Dev Login
          </button>
        </>
      ) : null}

      {!props.googleEnabled && !props.devEnabled ? (
        <div className="ui-empty">
          No auth providers configured. Set Google OAuth (`GOOGLE_CLIENT_ID` /
          `GOOGLE_CLIENT_SECRET`) or enable dev login (`MVP_FACTORY_CONTROL_DEV_LOGIN_PASSWORD`).
        </div>
      ) : null}
    </div>
  );
//> Brace or statement terminator.
}
