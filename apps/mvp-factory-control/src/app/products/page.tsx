/**
 * **Products** index: links to per-product config, board item counts, bootstrap/clean actions for MVP Factory project.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import {
  bootstrapMVPFactoryControlProjectAction,
  cleanProjectSettingsAction
} from "@/app/products/actions";
import { getProjectMeta, listProjectItems } from "@/lib/github";
import { readMVPFactoryControlSettings } from "@/lib/settings-store";
import { requireSession } from "@/lib/session";
import { badgeClassName, buttonClassName } from "@/components/ui";

export default async function ProductsPage() {
  const session = await requireSession();
  if (!session) redirect("/signin");

  const settings = await readMVPFactoryControlSettings();
  let products: string[] = [];
  let boardItems:
    | Array<{
        issueNumber: number;
        fields: Record<string, string>;
      }>
    = [];
  let metaError: string | null = null;
  try {
    const [meta, items] = await Promise.all([
      getProjectMeta(),
      listProjectItems({ limit: 500 })
    ]);
    const productField = meta.fields.find((f) => f.name === "Product");
    products = productField?.options?.map((o) => o.name) ?? [];
    boardItems = items.map((it) => ({
      issueNumber: it.issueNumber,
      fields: it.fields
    }));
  } catch (e) {
    metaError = e instanceof Error ? e.message : String(e);
  }

  const configuredRows = new Map(
    settings.projects.map((p) => [p.projectName.toLowerCase(), p] as const)
  );
  const configured = new Set(configuredRows.keys());
  const boardByLower = new Map(products.map((p) => [p.toLowerCase(), p]));
  const boardSet = new Set(products.map((p) => p.toLowerCase()));
  const cardsByProductLower = new Map<
    string,
    {
      productName: string;
      total: number;
      statusCounts: Map<string, number>;
    }
  >();
  let unassignedCards = 0;
  for (const item of boardItems) {
    const rawProduct = (item.fields["Product"] || "").trim();
    if (!rawProduct) {
      unassignedCards += 1;
      continue;
    }
    const lower = rawProduct.toLowerCase();
    const canonical = boardByLower.get(lower) || rawProduct;
    const status = (item.fields["Status"] || "(unset)").trim();
    const bucket = cardsByProductLower.get(lower) || {
      productName: canonical,
      total: 0,
      statusCounts: new Map<string, number>()
    };
    bucket.productName = canonical;
    bucket.total += 1;
    bucket.statusCounts.set(status, (bucket.statusCounts.get(status) || 0) + 1);
    cardsByProductLower.set(lower, bucket);
  }

  const visibleByLower = new Map<string, string>();
  for (const name of products) {
    visibleByLower.set(name.toLowerCase(), name);
  }
  for (const lower of configuredRows.keys()) {
    const configuredName = configuredRows.get(lower)?.projectName || lower;
    if (!visibleByLower.has(lower)) {
      visibleByLower.set(lower, boardByLower.get(lower) || configuredName);
    }
  }
  for (const [lower, bucket] of cardsByProductLower.entries()) {
    if (!visibleByLower.has(lower)) {
      visibleByLower.set(lower, bucket.productName);
    }
  }

  const rows = Array.from(visibleByLower.entries()).map(([lower, name]) => {
    const bucket = cardsByProductLower.get(lower);
    const statusCounts = bucket ? Array.from(bucket.statusCounts.entries()) : [];
    statusCounts.sort((a, b) => b[1] - a[1]);
    return {
      lower,
      name,
      total: bucket?.total || 0,
      statusCounts,
      boardLinked: boardSet.has(lower),
      configured: configured.has(lower)
    };
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.boardLinked !== b.boardLinked) return a.boardLinked ? -1 : 1;
    if (a.configured !== b.configured) return a.configured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const activeRows = rows.filter((r) => r.total > 0);
  const configuredNoCardsRows = rows.filter((r) => r.total === 0 && r.configured);
  const staleOptionRows = rows.filter((r) => r.total === 0 && !r.configured && r.boardLinked);
  const totalCards = activeRows.reduce((sum, row) => sum + row.total, 0);
  const topStatusCounts = new Map<string, number>();
  for (const row of activeRows) {
    for (const [status, count] of row.statusCounts) {
      topStatusCounts.set(status, (topStatusCounts.get(status) || 0) + count);
    }
  }
  const statusSummary = Array.from(topStatusCounts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <Shell title="Products" subtitle="Multi-tenant by Product field on the board">
      {metaError ? (
        <div className="ui-empty border-amber-300/25 bg-amber-200/10 text-amber-100">
          GitHub product options unavailable: {metaError}
        </div>
      ) : null}
      <div className="ui-panel ui-panel--hero ui-stack-md">
        <div className="ui-toolbar">
          <div className="ui-copy max-w-4xl">
            Truth source: cards on the GitHub board. Product options are metadata only and can be stale. This view
            keeps board+local union but prioritizes actual card counts and status mix.
          </div>
          <div className="ui-toolbar__actions">
            <form action={cleanProjectSettingsAction}>
              <button
                type="submit"
                className={buttonClassName("secondary")}
              >
                Clean Local Project Config
              </button>
            </form>
            <form action={bootstrapMVPFactoryControlProjectAction}>
              <button
                type="submit"
                className={buttonClassName("success")}
              >
                Add/Refresh mvp-factory-control Project
              </button>
            </form>
          </div>
        </div>
        <div className="ui-inline-cluster">
          <span className={badgeClassName()}>
            Active products: {activeRows.length}
          </span>
          <span className={badgeClassName()}>
            Cards on board: {totalCards}
          </span>
          <span className={badgeClassName()}>
            Unassigned cards: {unassignedCards}
          </span>
          {statusSummary.slice(0, 4).map(([status, count]) => (
            <span key={`status:${status}`} className={badgeClassName("accent")}>
              {status}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="ui-grid-2">
        {activeRows.map((row) => (
          <Link
            key={row.lower}
            href={`/products/${encodeURIComponent(row.name)}`}
            className="ui-panel ui-stack-md"
          >
            <div className="ui-toolbar">
              <div className="text-lg font-semibold text-white/95">{row.name}</div>
              <div className={badgeClassName("accent")}>
                {row.total} cards
              </div>
            </div>
            <div className="ui-inline-cluster">
              {row.statusCounts.slice(0, 4).map(([status, count]) => (
                <span key={`${row.lower}:${status}`} className={badgeClassName()}>
                  {status}: {count}
                </span>
              ))}
            </div>
            <div className="ui-inline-cluster">
              <span
                className={badgeClassName(row.configured ? "success" : "default")}
              >
                {row.configured ? "Configured" : "No config"}
              </span>
              <span
                className={badgeClassName(row.boardLinked ? "default" : "warning")}
              >
                {row.boardLinked ? "Board option" : "No board option"}
              </span>
            </div>
            <div className="ui-copy">View cards and edit settings scoped to this product.</div>
          </Link>
        ))}
      </div>
      {activeRows.length === 0 ? (
        <div className="ui-empty">
          No active product cards found on the board.
        </div>
      ) : null}

      {configuredNoCardsRows.length > 0 ? (
        <div className="ui-panel ui-stack-md">
          <div className="ui-section-title">Configured products without board cards</div>
          <div className="ui-meta">
            These are configured locally but currently have zero cards on the board.
          </div>
          <div className="ui-grid-2">
            {configuredNoCardsRows.map((row) => (
              <Link
                key={`configured-empty:${row.lower}`}
                href={`/products/${encodeURIComponent(row.name)}`}
                className="ui-subpanel"
              >
                <div className="ui-toolbar">
                  <div className="text-sm font-semibold text-white/90">{row.name}</div>
                  <div className={badgeClassName()}>
                    0 cards
                  </div>
                </div>
                <div className="mt-1 ui-meta">
                  {row.boardLinked
                    ? "Board option exists; no cards currently."
                    : "Local config exists but Product option is missing from board."}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {staleOptionRows.length > 0 ? (
        <div className="ui-panel ui-stack-md border-amber-300/20 bg-amber-200/10">
          <div className="ui-section-title text-amber-100">Board product options with no cards/config</div>
          <div className="ui-meta text-amber-100/80">
            These options may be stale board metadata and are not currently active products.
          </div>
          <div className="ui-inline-cluster">
            {staleOptionRows.map((row) => (
              <span key={`stale:${row.lower}`} className={badgeClassName("warning")}>
                {row.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
