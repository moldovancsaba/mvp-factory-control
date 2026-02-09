# MVP Factory Board — one-time setup (access for scripts and agents)

To let scripts and agents **read and set project fields** (Status, Agent, Product, Type, Priority) on the [MVP Factory Board](https://github.com/users/moldovancsaba/projects/1), the GitHub CLI must have **project** scope.

## One-time step

Run in a terminal (including your IDE terminal). You will need to complete the browser step:

```bash
gh auth refresh -h github.com -s read:project,project
```

1. Copy the one-time code from the output.
2. Open the URL in your browser.
3. Enter the code and approve the requested scopes.

After that, `gh` will use the new token and the script in this repo can read/update the board.

## Verify

```bash
gh auth status
```

You should see **project** (or at least **read:project**) in **Token scopes**.

## Requirements for the script

- **gh** — [GitHub CLI](https://cli.github.com/) installed and logged in (with project scope as above).
- **jq** — Used to parse GraphQL responses. Install if needed (e.g. `brew install jq`, or your system package manager).

## What uses this

- **scripts/mvp-factory-set-project-fields.sh** — Sets Status, Agent, Product, Type, Priority on a board card (issue). Reads current state first; only updates fields you pass (no overwrite of other agents’ fields).

You only need to run the refresh once per machine (or when the token is rotated).
