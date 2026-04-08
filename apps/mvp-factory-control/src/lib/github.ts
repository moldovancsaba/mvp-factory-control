/**
 * GitHub GraphQL API client and board/project helpers for the control plane.
 *
 * - Token resolution: `MVP_FACTORY_CONTROL_GITHUB_TOKEN` (preferred), then `GITHUB_TOKEN`, then
 *   `MVP_PROJECT_TOKEN`. Missing token throws at request time.
 * - All requests use `fetch` to `https://api.github.com/graphql` with `cache: "no-store"`.
 * - Exports types and functions used by dashboard, issues UI, agents/products reconciliation, and
 *   task/issue automation. See call sites in `src/app/*` and `src/lib/tasks.ts`.
 */
//> Type or interface definition.
type GraphQLResponse<T> =
  //> Source statement or expression.
  | { data: T; errors?: undefined }
  //> Source statement or expression.
  | { data?: undefined; errors: Array<{ message: string }> };

//> Function declaration.
function getGithubToken() {
  //> Variable declaration.
  const token =
    //> Source statement or expression.
    process.env.MVP_FACTORY_CONTROL_GITHUB_TOKEN ||
    //> Source statement or expression.
    process.env.GITHUB_TOKEN ||
    //> Source statement or expression.
    process.env.MVP_PROJECT_TOKEN;
  //> Conditional branch.
  if (!token) {
    //> Throw error.
    throw new Error(
      //> String literal line.
      "Missing GitHub token. Set MVP_FACTORY_CONTROL_GITHUB_TOKEN (recommended) or GITHUB_TOKEN."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Return a value.
  return token;
//> Brace or statement terminator.
}

//> Async function declaration.
async function ghGraphQL<T>(
  //> Source statement or expression.
  query: string,
  //> Source statement or expression.
  variables: Record<string, unknown>
//> Source statement or expression.
): Promise<T> {
  //> Variable declaration.
  const res = await fetch("https://api.github.com/graphql", {
    //> Source statement or expression.
    method: "POST",
    //> Source statement or expression.
    headers: {
      //> Source statement or expression.
      Authorization: `bearer ${getGithubToken()}`,
      //> String literal line.
      "Content-Type": "application/json"
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    body: JSON.stringify({ query, variables }),
    //> Source statement or expression.
    cache: "no-store"
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!res.ok) {
    //> Variable declaration.
    const text = await res.text();
    //> Throw error.
    throw new Error(`GitHub GraphQL HTTP ${res.status}: ${text}`);
  //> Brace or statement terminator.
  }
  //> Const with function or expression.
  const json = (await res.json()) as GraphQLResponse<T>;
  //> Conditional branch.
  if ("errors" in json && json.errors?.length) {
    //> Throw error.
    throw new Error(`GitHub GraphQL error: ${json.errors[0]?.message}`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!("data" in json) || !json.data) {
    //> Throw error.
    throw new Error("GitHub GraphQL returned no data.");
  //> Brace or statement terminator.
  }
  //> Return a value.
  return json.data;
//> Brace or statement terminator.
}

//> Export declaration.
export type ProjectFieldOption = {
  //> Source statement or expression.
  id: string;
  //> Source statement or expression.
  name: string;
  //> Source statement or expression.
  color?: string;
  //> Source statement or expression.
  description?: string;
//> Brace or statement terminator.
};
//> Export declaration.
export type ProjectField = {
  //> Source statement or expression.
  id: string;
  //> Source statement or expression.
  name: string;
  //> Source statement or expression.
  options?: ProjectFieldOption[];
//> Brace or statement terminator.
};

//> Export declaration.
export type CanonicalAgentRef = {
  //> Source statement or expression.
  key: string;
  //> Source statement or expression.
  displayName?: string | null;
  //> Source statement or expression.
  enabled?: boolean;
  //> Source statement or expression.
  runtime?: string | null;
//> Brace or statement terminator.
};

//> Export declaration.
export type BoardAgentResolution = {
  //> Source statement or expression.
  rawValue: string | null;
  //> Source statement or expression.
  normalizedValue: string | null;
  //> Source statement or expression.
  status: "EMPTY" | "MAPPED" | "UNMAPPED";
  //> Source statement or expression.
  mappedAgentKey: string | null;
  //> Source statement or expression.
  mappedAgentDisplayName: string | null;
//> Brace or statement terminator.
};

//> Export declaration.
export type BoardAgentReconciliation = {
  //> Source statement or expression.
  optionRows: Array<{
    //> Source statement or expression.
    boardOption: string;
    //> Source statement or expression.
    status: "MAPPED" | "UNMAPPED";
    //> Source statement or expression.
    mappedAgentKey: string | null;
    //> Source statement or expression.
    mappedAgentDisplayName: string | null;
  //> Delimiter or separator.
  }>;
  //> Source statement or expression.
  mappedCount: number;
  //> Source statement or expression.
  unmappedCount: number;
  //> Source statement or expression.
  dbOnlyAgents: Array<{ key: string; displayName: string | null }>;
//> Brace or statement terminator.
};

//> Function declaration.
function normalizeAgentIdentity(input: string | null | undefined) {
  //> Variable declaration.
  const value = String(input || "").trim();
  //> Return a value.
  return value ? value.toLowerCase() : "";
//> Brace or statement terminator.
}

//> Function declaration.
function pickAgentCaseVariant(
  //> Source statement or expression.
  existing: CanonicalAgentRef | undefined,
  //> Source statement or expression.
  next: CanonicalAgentRef
//> Source statement or expression.
) {
  //> Conditional branch.
  if (!existing) return next;
  //> Variable declaration.
  const existingIsLower = existing.key === existing.key.toLowerCase();
  //> Variable declaration.
  const nextIsLower = next.key === next.key.toLowerCase();
  //> Conditional branch.
  if (existingIsLower && !nextIsLower) return next;
  //> Return a value.
  return existing;
//> Brace or statement terminator.
}

//> Function declaration.
function buildCanonicalAgentIndex(dbAgents: CanonicalAgentRef[]) {
  //> Variable declaration.
  const byLower = new Map<string, CanonicalAgentRef>();
  //> For-loop header.
  for (const row of dbAgents) {
    //> Variable declaration.
    const key = String(row.key || "").trim();
    //> Variable declaration.
    const lower = normalizeAgentIdentity(key);
    //> Conditional branch.
    if (!lower) continue;
    //> Variable declaration.
    const normalized = { ...row, key };
    //> Source statement or expression.
    byLower.set(lower, pickAgentCaseVariant(byLower.get(lower), normalized));
  //> Brace or statement terminator.
  }
  //> Return a value.
  return byLower;
//> Brace or statement terminator.
}

//> Export declaration.
export function reconcileBoardAgentValue(params: {
  //> Source statement or expression.
  boardAgentValue: string | null | undefined;
  //> Source statement or expression.
  dbAgents: CanonicalAgentRef[];
//> Source statement or expression.
}): BoardAgentResolution {
  //> Variable declaration.
  const rawValue = String(params.boardAgentValue || "").trim();
  //> Conditional branch.
  if (!rawValue) {
    //> Return a value.
    return {
      //> Source statement or expression.
      rawValue: null,
      //> Source statement or expression.
      normalizedValue: null,
      //> Source statement or expression.
      status: "EMPTY",
      //> Source statement or expression.
      mappedAgentKey: null,
      //> Source statement or expression.
      mappedAgentDisplayName: null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const byLower = buildCanonicalAgentIndex(params.dbAgents);
  //> Variable declaration.
  const match = byLower.get(normalizeAgentIdentity(rawValue));
  //> Conditional branch.
  if (!match) {
    //> Return a value.
    return {
      //> Source statement or expression.
      rawValue,
      //> Source statement or expression.
      normalizedValue: normalizeAgentIdentity(rawValue),
      //> Source statement or expression.
      status: "UNMAPPED",
      //> Source statement or expression.
      mappedAgentKey: null,
      //> Source statement or expression.
      mappedAgentDisplayName: null
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    rawValue,
    //> Source statement or expression.
    normalizedValue: normalizeAgentIdentity(rawValue),
    //> Source statement or expression.
    status: "MAPPED",
    //> Source statement or expression.
    mappedAgentKey: match.key,
    //> Source statement or expression.
    mappedAgentDisplayName: match.displayName ?? null
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export function reconcileBoardAgentOptions(params: {
  //> Source statement or expression.
  boardAgentOptions: string[];
  //> Source statement or expression.
  dbAgents: CanonicalAgentRef[];
//> Source statement or expression.
}): BoardAgentReconciliation {
  //> Variable declaration.
  const byLower = buildCanonicalAgentIndex(params.dbAgents);
  //> Variable declaration.
  const optionRows: BoardAgentReconciliation["optionRows"] = [];
  //> Variable declaration.
  const seenMappedKeys = new Set<string>();

  //> For-loop header.
  for (const option of params.boardAgentOptions) {
    //> Variable declaration.
    const boardOption = String(option || "").trim();
    //> Conditional branch.
    if (!boardOption) continue;
    //> Variable declaration.
    const match = byLower.get(normalizeAgentIdentity(boardOption));
    //> Conditional branch.
    if (match) {
      //> Source statement or expression.
      seenMappedKeys.add(normalizeAgentIdentity(match.key));
      //> Source statement or expression.
      optionRows.push({
        //> Source statement or expression.
        boardOption,
        //> Source statement or expression.
        status: "MAPPED",
        //> Source statement or expression.
        mappedAgentKey: match.key,
        //> Source statement or expression.
        mappedAgentDisplayName: match.displayName ?? null
      //> Brace or statement terminator.
      });
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }
    //> Source statement or expression.
    optionRows.push({
      //> Source statement or expression.
      boardOption,
      //> Source statement or expression.
      status: "UNMAPPED",
      //> Source statement or expression.
      mappedAgentKey: null,
      //> Source statement or expression.
      mappedAgentDisplayName: null
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const dbOnlyAgents = params.dbAgents
    //> Source statement or expression.
    .filter((row) => {
      //> Variable declaration.
      const lower = normalizeAgentIdentity(row.key);
      //> Return a value.
      return lower && !seenMappedKeys.has(lower);
    //> Delimiter or separator.
    })
    //> Source statement or expression.
    .map((row) => ({
      //> Source statement or expression.
      key: row.key,
      //> Source statement or expression.
      displayName: row.displayName ?? null
    //> Delimiter or separator.
    }))
    //> Source statement or expression.
    .sort((a, b) => a.key.localeCompare(b.key));

  //> Return a value.
  return {
    //> Source statement or expression.
    optionRows,
    //> Source statement or expression.
    mappedCount: optionRows.filter((r) => r.status === "MAPPED").length,
    //> Source statement or expression.
    unmappedCount: optionRows.filter((r) => r.status === "UNMAPPED").length,
    //> Source statement or expression.
    dbOnlyAgents
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export async function getProjectMeta() {
  //> Variable declaration.
  const owner = process.env.MVP_FACTORY_CONTROL_GITHUB_PROJECT_OWNER || "moldovancsaba";
  //> Variable declaration.
  const number = Number(process.env.MVP_FACTORY_CONTROL_GITHUB_PROJECT_NUMBER || "1");

  //> Variable declaration.
  const data = await ghGraphQL<{
    //> Source statement or expression.
    user: {
      //> Source statement or expression.
      projectV2: {
        //> Source statement or expression.
        id: string;
        //> Source statement or expression.
        title: string;
        //> Source statement or expression.
        fields: {
          //> Source statement or expression.
          nodes: Array<
            //> Source statement or expression.
            | { __typename: "ProjectV2Field"; id: string; name: string }
            //> Source statement or expression.
            | {
                //> Source statement or expression.
                __typename: "ProjectV2SingleSelectField";
                //> Source statement or expression.
                id: string;
                //> Source statement or expression.
                name: string;
                //> Source statement or expression.
                options: ProjectFieldOption[];
              //> Brace or statement terminator.
              }
          //> Delimiter or separator.
          >;
        //> Brace or statement terminator.
        };
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    };
  //> Source statement or expression.
  }>(
    //> String literal line.
    `query($owner:String!, $num:Int!) {
      //> Source statement or expression.
      user(login:$owner) {
        //> Source statement or expression.
        projectV2(number:$num) {
          //> Source statement or expression.
          id
          //> Source statement or expression.
          title
          //> Source statement or expression.
          fields(first:50) {
            //> Source statement or expression.
            nodes {
              //> Source statement or expression.
              __typename
              //> Source statement or expression.
              ... on ProjectV2Field { id name }
              //> Source statement or expression.
              ... on ProjectV2SingleSelectField { id name options { id name color description } }
            //> Brace or statement terminator.
            }
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Source statement or expression.
    }`,
    //> Source statement or expression.
    { owner, num: number }
  //> Delimiter or separator.
  );

  //> Variable declaration.
  const fields: ProjectField[] = data.user.projectV2.fields.nodes.map((n) => {
    //> Conditional branch.
    if (n.__typename === "ProjectV2SingleSelectField") {
      //> Return a value.
      return { id: n.id, name: n.name, options: n.options };
    //> Brace or statement terminator.
    }
    //> Return a value.
    return { id: n.id, name: n.name };
  //> Brace or statement terminator.
  });

  //> Return a value.
  return {
    //> Source statement or expression.
    owner,
    //> Source statement or expression.
    number,
    //> Source statement or expression.
    id: data.user.projectV2.id,
    //> Source statement or expression.
    title: data.user.projectV2.title,
    //> Source statement or expression.
    fields
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Export declaration.
export type ProjectItem = {
  //> Source statement or expression.
  itemId: string;
  //> Source statement or expression.
  issueNumber: number;
  //> Source statement or expression.
  issueTitle: string;
  //> Source statement or expression.
  issueUrl: string;
  //> Source statement or expression.
  repository?: string;
  //> Source statement or expression.
  fields: Record<string, string>;
//> Brace or statement terminator.
};

//> Type or interface definition.
type SingleSelectValueNode = {
  //> Source statement or expression.
  __typename: "ProjectV2ItemFieldSingleSelectValue";
  //> Source statement or expression.
  name: string | null;
  //> Source statement or expression.
  field: { name: string };
//> Brace or statement terminator.
};

//> Function declaration.
function isSingleSelectValueNode(n: { __typename: string }): n is SingleSelectValueNode {
  //> Return a value.
  return n.__typename === "ProjectV2ItemFieldSingleSelectValue";
//> Brace or statement terminator.
}

//> Export declaration.
export async function listProjectItems(params?: {
  //> Source statement or expression.
  product?: string;
  //> Source statement or expression.
  status?: string;
  //> Source statement or expression.
  agent?: string;
  //> Source statement or expression.
  priority?: string;
  //> Source statement or expression.
  limit?: number;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const { id: projectId } = await getProjectMeta();
  //> Variable declaration.
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);

  //> Variable declaration.
  const items: ProjectItem[] = [];
  //> Variable declaration.
  let after: string | null = null;

  //> While-loop header.
  while (items.length < limit) {
    //> Type or interface definition.
    type ItemsQuery = {
      //> Source statement or expression.
      node: {
        //> Source statement or expression.
        items: {
          //> Source statement or expression.
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          //> Source statement or expression.
          nodes: Array<{
            //> Source statement or expression.
            id: string;
            //> Source statement or expression.
            content:
              //> Source statement or expression.
              | null
              //> Source statement or expression.
              | {
                  //> Source statement or expression.
                  __typename: "Issue";
                  //> Source statement or expression.
                  number: number;
                  //> Source statement or expression.
                  title: string;
                  //> Source statement or expression.
                  url: string;
                  //> Source statement or expression.
                  repository: { nameWithOwner: string };
                //> Brace or statement terminator.
                };
            //> Source statement or expression.
            fieldValues: { nodes: Array<SingleSelectValueNode | { __typename: string }> };
          //> Delimiter or separator.
          }>;
        //> Brace or statement terminator.
        };
      //> Brace or statement terminator.
      };
    //> Brace or statement terminator.
    };

    //> Variable declaration.
    const data: ItemsQuery = await ghGraphQL(
      //> String literal line.
      `query($projectId:ID!, $after:String) {
        //> Source statement or expression.
        node(id:$projectId) {
          //> Source statement or expression.
          ... on ProjectV2 {
            //> Source statement or expression.
            items(first:50, after:$after) {
              //> Source statement or expression.
              pageInfo { hasNextPage endCursor }
              //> Source statement or expression.
              nodes {
                //> Source statement or expression.
                id
                //> Source statement or expression.
                content {
                  //> Source statement or expression.
                  __typename
                  //> Source statement or expression.
                  ... on Issue {
                    //> Source statement or expression.
                    number
                    //> Source statement or expression.
                    title
                    //> Source statement or expression.
                    url
                    //> Source statement or expression.
                    repository { nameWithOwner }
                  //> Brace or statement terminator.
                  }
                //> Brace or statement terminator.
                }
                //> Source statement or expression.
                fieldValues(first:30) {
                  //> Source statement or expression.
                  nodes {
                    //> Source statement or expression.
                    __typename
                    //> Source statement or expression.
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      //> Source statement or expression.
                      name
                      //> Source statement or expression.
                      field { ... on ProjectV2FieldCommon { name } }
                    //> Brace or statement terminator.
                    }
                  //> Brace or statement terminator.
                  }
                //> Brace or statement terminator.
                }
              //> Brace or statement terminator.
              }
            //> Brace or statement terminator.
            }
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        }
      //> Source statement or expression.
      }`,
      //> Source statement or expression.
      { projectId, after }
    //> Delimiter or separator.
    );

    //> For-loop header.
    for (const node of data.node.items.nodes) {
      //> Conditional branch.
      if (!node.content || node.content.__typename !== "Issue") continue;
      //> Variable declaration.
      const fields: Record<string, string> = {};
      //> For-loop header.
      for (const fv of node.fieldValues.nodes) {
        //> Conditional branch.
        if (isSingleSelectValueNode(fv)) {
          //> Conditional branch.
          if (fv.field?.name && fv.name) fields[fv.field.name] = fv.name;
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
      //> Variable declaration.
      const item: ProjectItem = {
        //> Source statement or expression.
        itemId: node.id,
        //> Source statement or expression.
        issueNumber: node.content.number,
        //> Source statement or expression.
        issueTitle: node.content.title,
        //> Source statement or expression.
        issueUrl: node.content.url,
        //> Source statement or expression.
        repository: node.content.repository?.nameWithOwner,
        //> Source statement or expression.
        fields
      //> Brace or statement terminator.
      };

      //> Conditional branch.
      if (params?.product && fields["Product"] !== params.product) continue;
      //> Conditional branch.
      if (params?.status && fields["Status"] !== params.status) continue;
      //> Conditional branch.
      if (params?.agent && fields["Agent"] !== params.agent) continue;
      //> Conditional branch.
      if (params?.priority && fields["Priority"] !== params.priority) continue;

      //> Source statement or expression.
      items.push(item);
      //> Conditional branch.
      if (items.length >= limit) break;
    //> Brace or statement terminator.
    }

    //> Conditional branch.
    if (!data.node.items.pageInfo.hasNextPage) break;
    //> Source statement or expression.
    after = data.node.items.pageInfo.endCursor;
    //> Conditional branch.
    if (!after) break;
  //> Brace or statement terminator.
  }

  //> Return a value.
  return items;
//> Brace or statement terminator.
}

//> Export declaration.
export async function ensureProjectItemForIssue(params: {
  //> Source statement or expression.
  issueNumber: number;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const { issueNumber } = params;
  //> Variable declaration.
  const { id: projectId } = await getProjectMeta();
  //> Variable declaration.
  const repoOwner = process.env.MVP_FACTORY_CONTROL_TASK_REPO_OWNER || "moldovancsaba";
  //> Variable declaration.
  const repoName = process.env.MVP_FACTORY_CONTROL_TASK_REPO_NAME || "mvp-factory-control";

  //> Variable declaration.
  const issueData = await ghGraphQL<{
    //> Source statement or expression.
    repository: { issue: { id: string } | null } | null;
  //> Source statement or expression.
  }>(
    //> String literal line.
    `query($owner:String!, $repo:String!, $num:Int!) {
      //> Source statement or expression.
      repository(owner:$owner, name:$repo) {
        //> Source statement or expression.
        issue(number:$num) { id }
      //> Brace or statement terminator.
      }
    //> Source statement or expression.
    }`,
    //> Source statement or expression.
    { owner: repoOwner, repo: repoName, num: issueNumber }
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const issueId = issueData.repository?.issue?.id;
  //> Conditional branch.
  if (!issueId) {
    //> Throw error.
    throw new Error(`Issue not found: ${repoOwner}/${repoName}#${issueNumber}`);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const addData = await ghGraphQL<{
    //> Source statement or expression.
    addProjectV2ItemById: { item: { id: string } };
  //> Source statement or expression.
  }>(
    //> String literal line.
    `mutation($projectId:ID!, $contentId:ID!) {
      //> Source statement or expression.
      addProjectV2ItemById(input:{ projectId:$projectId, contentId:$contentId }) {
        //> Source statement or expression.
        item { id }
      //> Brace or statement terminator.
      }
    //> Source statement or expression.
    }`,
    //> Source statement or expression.
    { projectId, contentId: issueId }
  //> Delimiter or separator.
  );

  //> Return a value.
  return { itemId: addData.addProjectV2ItemById.item.id, projectId };
//> Brace or statement terminator.
}

//> Export declaration.
export async function updateSingleSelectField(params: {
  //> Source statement or expression.
  itemId: string;
  //> Source statement or expression.
  fieldName: string;
  //> Source statement or expression.
  optionName: string;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const meta = await getProjectMeta();
  //> Variable declaration.
  const field = meta.fields.find((f) => f.name === params.fieldName);
  //> Conditional branch.
  if (!field) throw new Error(`Field not found: ${params.fieldName}`);
  //> Variable declaration.
  const optionId =
    //> Source statement or expression.
    field.options?.find(
      //> Source statement or expression.
      (o) => o.name.toLowerCase() === params.optionName.toLowerCase()
    //> Source statement or expression.
    )?.id ?? null;
  //> Conditional branch.
  if (!optionId) {
    //> Throw error.
    throw new Error(
      //> String literal line.
      `Option not found for ${params.fieldName}: ${params.optionName}`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Await async value.
  await ghGraphQL<{
    //> Source statement or expression.
    updateProjectV2ItemFieldValue: { projectV2Item: { id: string } };
  //> Source statement or expression.
  }>(
    //> String literal line.
    `mutation($projectId:ID!, $itemId:ID!, $fieldId:ID!, $optionId:String!) {
      //> Source statement or expression.
      updateProjectV2ItemFieldValue(input:{
        //> Source statement or expression.
        projectId:$projectId,
        //> Source statement or expression.
        itemId:$itemId,
        //> Source statement or expression.
        fieldId:$fieldId,
        //> Source statement or expression.
        value:{ singleSelectOptionId:$optionId }
      //> Source statement or expression.
      }) { projectV2Item { id } }
    //> Source statement or expression.
    }`,
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      projectId: meta.id,
      //> Source statement or expression.
      itemId: params.itemId,
      //> Source statement or expression.
      fieldId: field.id,
      //> Source statement or expression.
      optionId
    //> Brace or statement terminator.
    }
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Export declaration.
export async function getItemSingleSelectValues(params: { itemId: string }) {
  //> Variable declaration.
  const data = await ghGraphQL<{
    //> Source statement or expression.
    node: {
      //> Source statement or expression.
      fieldValues: {
        //> Source statement or expression.
        nodes: Array<
          //> Source statement or expression.
          | SingleSelectValueNode
          //> Source statement or expression.
          | { __typename: string }
        //> Delimiter or separator.
        >;
      //> Brace or statement terminator.
      };
    //> Source statement or expression.
    } | null;
  //> Source statement or expression.
  }>(
    //> String literal line.
    `query($itemId:ID!) {
      //> Source statement or expression.
      node(id:$itemId) {
        //> Source statement or expression.
        ... on ProjectV2Item {
          //> Source statement or expression.
          fieldValues(first:30) {
            //> Source statement or expression.
            nodes {
              //> Source statement or expression.
              __typename
              //> Source statement or expression.
              ... on ProjectV2ItemFieldSingleSelectValue {
                //> Source statement or expression.
                name
                //> Source statement or expression.
                field { ... on ProjectV2FieldCommon { name } }
              //> Brace or statement terminator.
              }
            //> Brace or statement terminator.
            }
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Source statement or expression.
    }`,
    //> Source statement or expression.
    { itemId: params.itemId }
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const out: Record<string, string> = {};
  //> For-loop header.
  for (const n of data.node?.fieldValues.nodes ?? []) {
    //> Conditional branch.
    if (isSingleSelectValueNode(n)) {
      //> Conditional branch.
      if (n.field?.name && n.name) out[n.field.name] = n.name;
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }
  //> Return a value.
  return out;
//> Brace or statement terminator.
}

//> Export declaration.
export async function getIssueDetails(params: { issueNumber: number }) {
  //> Variable declaration.
  const repoOwner = process.env.MVP_FACTORY_CONTROL_TASK_REPO_OWNER || "moldovancsaba";
  //> Variable declaration.
  const repoName = process.env.MVP_FACTORY_CONTROL_TASK_REPO_NAME || "mvp-factory-control";

  //> Variable declaration.
  const data = await ghGraphQL<{
    //> Source statement or expression.
    repository: {
      //> Source statement or expression.
      issue: {
        //> Source statement or expression.
        number: number;
        //> Source statement or expression.
        title: string;
        //> Source statement or expression.
        url: string;
        //> Source statement or expression.
        body: string | null;
        //> Source statement or expression.
        createdAt: string;
        //> Source statement or expression.
        updatedAt: string;
      //> Source statement or expression.
      } | null;
    //> Source statement or expression.
    } | null;
  //> Source statement or expression.
  }>(
    //> String literal line.
    `query($owner:String!, $repo:String!, $num:Int!) {
      //> Source statement or expression.
      repository(owner:$owner, name:$repo) {
        //> Source statement or expression.
        issue(number:$num) {
          //> Source statement or expression.
          number
          //> Source statement or expression.
          title
          //> Source statement or expression.
          url
          //> Source statement or expression.
          body
          //> Source statement or expression.
          createdAt
          //> Source statement or expression.
          updatedAt
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Source statement or expression.
    }`,
    //> Source statement or expression.
    { owner: repoOwner, repo: repoName, num: params.issueNumber }
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const issue = data.repository?.issue;
  //> Conditional branch.
  if (!issue) throw new Error(`Issue not found: #${params.issueNumber}`);
  //> Return a value.
  return issue;
//> Brace or statement terminator.
}

//> Export declaration.
export async function ensureSingleSelectOption(params: {
  //> Source statement or expression.
  fieldName: string;
  //> Source statement or expression.
  optionName: string;
  //> Source statement or expression.
  color?: "GRAY" | "BLUE" | "GREEN" | "YELLOW" | "ORANGE" | "RED" | "PINK" | "PURPLE";
  //> Source statement or expression.
  description?: string;
//> Source statement or expression.
}) {
  //> Variable declaration.
  const fieldName = params.fieldName.trim();
  //> Variable declaration.
  const optionName = params.optionName.trim();
  //> Conditional branch.
  if (!fieldName) throw new Error("Missing fieldName.");
  //> Conditional branch.
  if (!optionName) throw new Error("Missing optionName.");

  //> Variable declaration.
  const meta = await getProjectMeta();
  //> Variable declaration.
  const field = meta.fields.find((f) => f.name === fieldName);
  //> Conditional branch.
  if (!field?.options) {
    //> Throw error.
    throw new Error(`Single-select field not found: ${fieldName}`);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const existing = field.options.find(
    //> Source statement or expression.
    (o) => o.name.toLowerCase() === optionName.toLowerCase()
  //> Delimiter or separator.
  );
  //> Conditional branch.
  if (existing) {
    //> Return a value.
    return { added: false, optionId: existing.id };
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const singleSelectOptions = field.options.map((o) => ({
    //> Source statement or expression.
    name: o.name,
    //> Source statement or expression.
    color:
      //> Source statement or expression.
      (o.color as
        //> Source statement or expression.
        | "GRAY"
        //> Source statement or expression.
        | "BLUE"
        //> Source statement or expression.
        | "GREEN"
        //> Source statement or expression.
        | "YELLOW"
        //> Source statement or expression.
        | "ORANGE"
        //> Source statement or expression.
        | "RED"
        //> Source statement or expression.
        | "PINK"
        //> Source statement or expression.
        | "PURPLE"
        //> Source statement or expression.
        | undefined) || "GRAY",
    //> Source statement or expression.
    description: o.description || ""
  //> Delimiter or separator.
  }));
  //> Source statement or expression.
  singleSelectOptions.push({
    //> Source statement or expression.
    name: optionName,
    //> Source statement or expression.
    color: params.color || "BLUE",
    //> Source statement or expression.
    description: params.description || ""
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const data = await ghGraphQL<{
    //> Source statement or expression.
    updateProjectV2Field: {
      //> Source statement or expression.
      projectV2Field:
        //> Source statement or expression.
        | {
            //> Source statement or expression.
            __typename: "ProjectV2SingleSelectField";
            //> Source statement or expression.
            options: Array<{ id: string; name: string }>;
          //> Brace or statement terminator.
          }
        //> Source statement or expression.
        | { __typename: string };
    //> Brace or statement terminator.
    };
  //> Source statement or expression.
  }>(
    //> String literal line.
    `mutation($fieldId:ID!, $name:String!, $singleSelectOptions:[ProjectV2SingleSelectFieldOptionInput!]) {
      //> Source statement or expression.
      updateProjectV2Field(input:{
        //> Source statement or expression.
        fieldId:$fieldId,
        //> Source statement or expression.
        name:$name,
        //> Source statement or expression.
        singleSelectOptions:$singleSelectOptions
      //> Source statement or expression.
      }) {
        //> Source statement or expression.
        projectV2Field {
          //> Source statement or expression.
          __typename
          //> Source statement or expression.
          ... on ProjectV2SingleSelectField {
            //> Source statement or expression.
            options { id name }
          //> Brace or statement terminator.
          }
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Source statement or expression.
    }`,
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      fieldId: field.id,
      //> Source statement or expression.
      name: field.name,
      //> Source statement or expression.
      singleSelectOptions
    //> Brace or statement terminator.
    }
  //> Delimiter or separator.
  );

  //> Variable declaration.
  const updated = data.updateProjectV2Field.projectV2Field;
  //> Conditional branch.
  if (updated.__typename !== "ProjectV2SingleSelectField" || !("options" in updated)) {
    //> Throw error.
    throw new Error(`Failed to update single-select field: ${fieldName}`);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const added = updated.options.find(
    //> Source statement or expression.
    (o) => o.name.toLowerCase() === optionName.toLowerCase()
  //> Delimiter or separator.
  );
  //> Conditional branch.
  if (!added?.id) {
    //> Throw error.
    throw new Error(`Option was not created on field ${fieldName}: ${optionName}`);
  //> Brace or statement terminator.
  }

  //> Return a value.
  return { added: true, optionId: added.id };
//> Brace or statement terminator.
}
