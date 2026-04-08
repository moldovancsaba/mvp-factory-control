/**
 * **Products** index: links to per-product config, board item counts, bootstrap/clean actions for MVP Factory project.
 */
//> Import bindings from a module.
import Link from "next/link";
//> Import bindings from a module.
import { redirect } from "next/navigation";
//> Import bindings from a module.
import { Shell } from "@/components/Shell";
//> Import bindings from a module.
import {
  //> Source statement or expression.
  bootstrapMVPFactoryControlProjectAction,
  //> Source statement or expression.
  cleanProjectSettingsAction
//> Source statement or expression.
} from "@/app/products/actions";
//> Import bindings from a module.
import { getProjectMeta, listProjectItems } from "@/lib/github";
//> Import bindings from a module.
import { readMVPFactoryControlSettings } from "@/lib/settings-store";
//> Import bindings from a module.
import { requireSession } from "@/lib/session";
//> Import bindings from a module.
import { badgeClassName, buttonClassName } from "@/components/ui";

//> Export declaration.
export default async function ProductsPage() {
  //> Variable declaration.
  const session = await requireSession();
  //> Conditional branch.
  if (!session) redirect("/signin");

  //> Variable declaration.
  const settings = await readMVPFactoryControlSettings();
  //> Variable declaration.
  let products: string[] = [];
  //> Variable declaration.
  let boardItems:
    //> Source statement or expression.
    | Array<{
        //> Source statement or expression.
        issueNumber: number;
        //> Source statement or expression.
        fields: Record<string, string>;
      //> Delimiter or separator.
      }>
    //> Source statement or expression.
    = [];
  //> Variable declaration.
  let metaError: string | null = null;
  //> Try block start.
  try {
    //> Variable declaration.
    const [meta, items] = await Promise.all([
      //> Source statement or expression.
      getProjectMeta(),
      //> Source statement or expression.
      listProjectItems({ limit: 500 })
    //> Delimiter or separator.
    ]);
    //> Variable declaration.
    const productField = meta.fields.find((f) => f.name === "Product");
    //> Source statement or expression.
    products = productField?.options?.map((o) => o.name) ?? [];
    //> Source statement or expression.
    boardItems = items.map((it) => ({
      //> Source statement or expression.
      issueNumber: it.issueNumber,
      //> Source statement or expression.
      fields: it.fields
    //> Delimiter or separator.
    }));
  //> Source statement or expression.
  } catch (e) {
    //> Source statement or expression.
    metaError = e instanceof Error ? e.message : String(e);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const configuredRows = new Map(
    //> Source statement or expression.
    settings.projects.map((p) => [p.projectName.toLowerCase(), p] as const)
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const configured = new Set(configuredRows.keys());
  //> Variable declaration.
  const boardByLower = new Map(products.map((p) => [p.toLowerCase(), p]));
  //> Variable declaration.
  const boardSet = new Set(products.map((p) => p.toLowerCase()));
  //> Variable declaration.
  const cardsByProductLower = new Map<
    //> Source statement or expression.
    string,
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      productName: string;
      //> Source statement or expression.
      total: number;
      //> Source statement or expression.
      statusCounts: Map<string, number>;
    //> Brace or statement terminator.
    }
  //> Source statement or expression.
  >();
  //> Variable declaration.
  let unassignedCards = 0;
  //> For-loop header.
  for (const item of boardItems) {
    //> Const with function or expression.
    const rawProduct = (item.fields["Product"] || "").trim();
    //> Conditional branch.
    if (!rawProduct) {
      //> Source statement or expression.
      unassignedCards += 1;
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const lower = rawProduct.toLowerCase();
    //> Variable declaration.
    const canonical = boardByLower.get(lower) || rawProduct;
    //> Const with function or expression.
    const status = (item.fields["Status"] || "(unset)").trim();
    //> Variable declaration.
    const bucket = cardsByProductLower.get(lower) || {
      //> Source statement or expression.
      productName: canonical,
      //> Source statement or expression.
      total: 0,
      //> Source statement or expression.
      statusCounts: new Map<string, number>()
    //> Brace or statement terminator.
    };
    //> Source statement or expression.
    bucket.productName = canonical;
    //> Source statement or expression.
    bucket.total += 1;
    //> Source statement or expression.
    bucket.statusCounts.set(status, (bucket.statusCounts.get(status) || 0) + 1);
    //> Source statement or expression.
    cardsByProductLower.set(lower, bucket);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const visibleByLower = new Map<string, string>();
  //> For-loop header.
  for (const name of products) {
    //> Source statement or expression.
    visibleByLower.set(name.toLowerCase(), name);
  //> Brace or statement terminator.
  }
  //> For-loop header.
  for (const lower of configuredRows.keys()) {
    //> Variable declaration.
    const configuredName = configuredRows.get(lower)?.projectName || lower;
    //> Conditional branch.
    if (!visibleByLower.has(lower)) {
      //> Source statement or expression.
      visibleByLower.set(lower, boardByLower.get(lower) || configuredName);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }
  //> For-loop header.
  for (const [lower, bucket] of cardsByProductLower.entries()) {
    //> Conditional branch.
    if (!visibleByLower.has(lower)) {
      //> Source statement or expression.
      visibleByLower.set(lower, bucket.productName);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const rows = Array.from(visibleByLower.entries()).map(([lower, name]) => {
    //> Variable declaration.
    const bucket = cardsByProductLower.get(lower);
    //> Variable declaration.
    const statusCounts = bucket ? Array.from(bucket.statusCounts.entries()) : [];
    //> Source statement or expression.
    statusCounts.sort((a, b) => b[1] - a[1]);
    //> Return a value.
    return {
      //> Source statement or expression.
      lower,
      //> Source statement or expression.
      name,
      //> Source statement or expression.
      total: bucket?.total || 0,
      //> Source statement or expression.
      statusCounts,
      //> Source statement or expression.
      boardLinked: boardSet.has(lower),
      //> Source statement or expression.
      configured: configured.has(lower)
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  });

  //> Source statement or expression.
  rows.sort((a, b) => {
    //> Conditional branch.
    if (b.total !== a.total) return b.total - a.total;
    //> Conditional branch.
    if (a.boardLinked !== b.boardLinked) return a.boardLinked ? -1 : 1;
    //> Conditional branch.
    if (a.configured !== b.configured) return a.configured ? -1 : 1;
    //> Return a value.
    return a.name.localeCompare(b.name);
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const activeRows = rows.filter((r) => r.total > 0);
  //> Variable declaration.
  const configuredNoCardsRows = rows.filter((r) => r.total === 0 && r.configured);
  //> Variable declaration.
  const staleOptionRows = rows.filter((r) => r.total === 0 && !r.configured && r.boardLinked);
  //> Variable declaration.
  const totalCards = activeRows.reduce((sum, row) => sum + row.total, 0);
  //> Variable declaration.
  const topStatusCounts = new Map<string, number>();
  //> For-loop header.
  for (const row of activeRows) {
    //> For-loop header.
    for (const [status, count] of row.statusCounts) {
      //> Source statement or expression.
      topStatusCounts.set(status, (topStatusCounts.get(status) || 0) + count);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const statusSummary = Array.from(topStatusCounts.entries()).sort((a, b) => b[1] - a[1]);

  //> Return a value.
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
//> Brace or statement terminator.
}
