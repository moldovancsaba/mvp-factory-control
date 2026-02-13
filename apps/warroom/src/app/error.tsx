"use client";

export default function GlobalError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          War Room error
        </h2>
        <p style={{ opacity: 0.8 }}>
          {props.error?.message || "Unknown error"}
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            padding: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: 12,
            background: "rgba(0,0,0,0.04)"
          }}
        >
          {props.error?.stack}
        </pre>
        <p style={{ opacity: 0.8 }}>
          If this is a database error: start Postgres and run Prisma migrations.
          See <code>docs/WARROOM_SETUP.md</code>.
        </p>
        <button
          onClick={() => props.reset()}
          style={{
            marginTop: 8,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.2)"
          }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}

