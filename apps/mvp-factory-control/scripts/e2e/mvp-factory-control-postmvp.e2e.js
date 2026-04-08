//> Private class field.
#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Post-MVP E2E-style script: exercises tool protocol validation, policy, and tool executors without Next.js.
 * Run via package script / CI when wired; uses local `scripts/lib/*` mirrors.
 */
//> Variable declaration.
const os = require("node:os");
//> Variable declaration.
const path = require("node:path");
//> Variable declaration.
const fsp = require("node:fs/promises");
//> Variable declaration.
const { spawnSync } = require("node:child_process");
//> Variable declaration.
const { validateToolCallProtocolEnvelope } = require("../lib/tool-call-protocol");
//> Variable declaration.
const { evaluateToolCommandPolicy } = require("../lib/tool-command-policy");
//> Variable declaration.
const { resolveFilesystemToolContext, executeFilesystemToolCall } = require("../lib/tool-filesystem");
//> Variable declaration.
const { resolveShellToolContext, executeShellToolCall } = require("../lib/tool-shell");
//> Variable declaration.
const { resolveGitToolContext, executeGitToolCall, ToolGitError } = require("../lib/tool-git");

//> Function declaration.
function assert(condition, message) {
  //> Conditional branch.
  if (!condition) {
    //> Throw error.
    throw new Error(message);
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function run(cmd, args, cwd) {
  //> Variable declaration.
  const out = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  //> Conditional branch.
  if (out.status !== 0) {
    //> Throw error.
    throw new Error(`${cmd} ${args.join(" ")} failed: ${out.stderr || out.stdout}`);
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Async function declaration.
async function exists(absPath) {
  //> Variable declaration.
  const stat = await fsp.stat(absPath).catch(() => null);
  //> Return a value.
  return Boolean(stat);
//> Brace or statement terminator.
}

//> Async function declaration.
async function stageToolCallProtocol() {
  //> Variable declaration.
  const envelope = {
    //> Source statement or expression.
    protocol: "mvp-factory-control.tool-call",
    //> Source statement or expression.
    version: "1.0",
    //> Source statement or expression.
    mode: "SEQUENTIAL",
    //> Source statement or expression.
    calls: [
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        id: "e2e-chat",
        //> Source statement or expression.
        tool: "chat.respond",
        //> Source statement or expression.
        args: { prompt: "status" },
        //> Source statement or expression.
        riskClass: "LOW",
        //> Source statement or expression.
        approval: "NONE"
      //> Brace or statement terminator.
      },
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        id: "e2e-shell",
        //> Source statement or expression.
        tool: "shell.exec",
        //> Source statement or expression.
        args: { command: "echo e2e-shell" },
        //> Source statement or expression.
        riskClass: "CRITICAL",
        //> Source statement or expression.
        approval: "HUMAN_APPROVAL"
      //> Brace or statement terminator.
      },
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        id: "e2e-git",
        //> Source statement or expression.
        tool: "git.status",
        //> Source statement or expression.
        args: {},
        //> Source statement or expression.
        riskClass: "MEDIUM",
        //> Source statement or expression.
        approval: "NONE"
      //> Brace or statement terminator.
      }
    //> Delimiter or separator.
    ]
  //> Brace or statement terminator.
  };

  //> Variable declaration.
  const validation = validateToolCallProtocolEnvelope(envelope);
  //> Source statement or expression.
  assert(validation.present && validation.ok, "tool-call protocol validation failed");
  //> Variable declaration.
  const policy = evaluateToolCommandPolicy(validation.envelope);
  //> Source statement or expression.
  assert(policy.allowed, "tool-command policy denied e2e envelope");
  //> Source statement or expression.
  assert(policy.requiresApproval, "tool-command policy should require approval for shell.exec");
  //> Return a value.
  return {
    //> Source statement or expression.
    protocolOk: validation.ok,
    //> Source statement or expression.
    policyAllowed: policy.allowed,
    //> Source statement or expression.
    policyRequiresApproval: policy.requiresApproval,
    //> Source statement or expression.
    highestRiskClass: policy.highestRiskClass
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function stageFilesystemAndShell(workspaceRoot) {
  //> Variable declaration.
  const fsContext = await resolveFilesystemToolContext({
    //> Source statement or expression.
    cwd: workspaceRoot,
    //> Source statement or expression.
    env: { MVP_FACTORY_CONTROL_WORKSPACE_ROOT: workspaceRoot }
  //> Brace or statement terminator.
  });

  //> Await async value.
  await executeFilesystemToolCall(
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      tool: "filesystem.write",
      //> Source statement or expression.
      args: { path: "rehearsal/e2e.txt", content: "mvp-factory-control-e2e" }
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    fsContext
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const readResult = await executeFilesystemToolCall(
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      tool: "filesystem.read",
      //> Source statement or expression.
      args: { path: "rehearsal/e2e.txt" }
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    fsContext
  //> Delimiter or separator.
  );
  //> Source statement or expression.
  assert(readResult.answer.includes("mvp-factory-control-e2e"), "filesystem read/write stage failed");

  //> Variable declaration.
  const streamEvents = [];
  //> Variable declaration.
  const shellContext = await resolveShellToolContext({
    //> Source statement or expression.
    sessionId: `e2e-${Date.now().toString(36)}`,
    //> Source statement or expression.
    workspaceRoots: fsContext.workspaceRoots,
    //> Source statement or expression.
    defaultCwd: workspaceRoot,
    //> Source statement or expression.
    env: process.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const shellResult = await executeShellToolCall(
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      tool: "shell.exec",
      //> Source statement or expression.
      args: { command: "printf 'shell-e2e-out\\n'; printf 'shell-e2e-err\\n' 1>&2" }
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    shellContext,
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      onOutput: (event) => streamEvents.push(event)
    //> Brace or statement terminator.
    }
  //> Delimiter or separator.
  );
  //> Source statement or expression.
  assert(shellResult.audit.exitCode === 0, "shell stage returned non-zero exit");
  //> Source statement or expression.
  assert(streamEvents.length >= 1, "shell streaming callback did not emit output");

  //> Return a value.
  return {
    //> Source statement or expression.
    filesystemOk: true,
    //> Source statement or expression.
    shellExitCode: shellResult.audit.exitCode,
    //> Source statement or expression.
    shellStreamEventCount: streamEvents.length,
    //> Source statement or expression.
    artifactSessionId: shellResult.audit.sessionId
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function stageGitFlow(tempRoot) {
  //> Variable declaration.
  const repo = path.join(tempRoot, "repo");
  //> Variable declaration.
  const remote = path.join(tempRoot, "remote.git");
  //> Await async value.
  await fsp.mkdir(repo, { recursive: true });
  //> Source statement or expression.
  run("git", ["init"], repo);
  //> Source statement or expression.
  run("git", ["config", "user.name", "MVP Factory Control E2E"], repo);
  //> Source statement or expression.
  run("git", ["config", "user.email", "mvp-factory-control-e2e@example.com"], repo);

  //> Await async value.
  await fsp.writeFile(path.join(repo, "README.md"), "# mvp-factory-control e2e\n", "utf8");

  //> Variable declaration.
  const gitContext = await resolveGitToolContext({
    //> Source statement or expression.
    workspaceRoots: [tempRoot],
    //> Source statement or expression.
    primaryWorkspaceRoot: tempRoot,
    //> Source statement or expression.
    env: process.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const statusResult = await executeGitToolCall(
    //> Source statement or expression.
    { tool: "git.status", args: { repoPath: repo } },
    //> Source statement or expression.
    gitContext
  //> Delimiter or separator.
  );
  //> Source statement or expression.
  assert(Boolean(statusResult.audit?.repoRoot), "git.status did not return repo metadata");

  //> Variable declaration.
  let protectedBranchCode = "none";
  //> Try block start.
  try {
    //> Await async value.
    await executeGitToolCall(
      //> Source statement or expression.
      { tool: "git.checkout", args: { repoPath: repo, branch: "main" } },
      //> Source statement or expression.
      gitContext
    //> Delimiter or separator.
    );
  //> Source statement or expression.
  } catch (error) {
    //> Conditional branch.
    if (error instanceof ToolGitError) {
      //> Source statement or expression.
      protectedBranchCode = error.code;
    //> Source statement or expression.
    } else {
      //> Throw error.
      throw error;
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }
  //> Source statement or expression.
  assert(
    //> Source statement or expression.
    protectedBranchCode === "PROTECTED_BRANCH_DENIED",
    //> String literal line.
    "protected-branch guard was not enforced"
  //> Delimiter or separator.
  );

  //> Await async value.
  await executeGitToolCall(
    //> Source statement or expression.
    { tool: "git.checkout", args: { repoPath: repo, branch: "feature/e2e", create: true } },
    //> Source statement or expression.
    gitContext
  //> Delimiter or separator.
  );
  //> Await async value.
  await executeGitToolCall(
    //> Source statement or expression.
    { tool: "git.add", args: { repoPath: repo, pathspec: ["README.md"] } },
    //> Source statement or expression.
    gitContext
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const commitResult = await executeGitToolCall(
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      tool: "git.commit",
      //> Source statement or expression.
      args: { repoPath: repo, message: "e2e: commit rehearsal file" }
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    gitContext
  //> Delimiter or separator.
  );
  //> Source statement or expression.
  assert(Boolean(commitResult.audit?.commitSha), "git.commit did not return commit SHA");

  //> Source statement or expression.
  run("git", ["init", "--bare", remote], tempRoot);
  //> Source statement or expression.
  run("git", ["remote", "add", "origin", remote], repo);
  //> Variable declaration.
  const pushResult = await executeGitToolCall(
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      tool: "git.push",
      //> Source statement or expression.
      args: { repoPath: repo, remote: "origin", branch: "feature/e2e", setUpstream: true }
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    gitContext
  //> Delimiter or separator.
  );
  //> Source statement or expression.
  assert(pushResult.answer.includes("git.push"), "git.push stage failed");

  //> Return a value.
  return {
    //> Source statement or expression.
    gitStatusOk: true,
    //> Source statement or expression.
    protectedBranchGuard: protectedBranchCode,
    //> Source statement or expression.
    commitSha: commitResult.audit.commitSha,
    //> Source statement or expression.
    pushOk: true
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function main() {
  //> Variable declaration.
  const startedAt = Date.now();
  //> Variable declaration.
  const summary = {
    //> Source statement or expression.
    runId: `mvp-factory-control-e2e-${new Date().toISOString()}`,
    //> Source statement or expression.
    stages: {}
  //> Brace or statement terminator.
  };

  //> Variable declaration.
  const workspaceRaw = await fsp.mkdtemp(path.join(os.tmpdir(), "mvp-factory-control-e2e-workspace-"));
  //> Variable declaration.
  const gitRaw = await fsp.mkdtemp(path.join(os.tmpdir(), "mvp-factory-control-e2e-git-"));
  //> Variable declaration.
  const workspaceRoot = await fsp.realpath(workspaceRaw);
  //> Variable declaration.
  const gitRoot = await fsp.realpath(gitRaw);

  //> Try block start.
  try {
    //> Source statement or expression.
    summary.stages.protocol = await stageToolCallProtocol();
    //> Source statement or expression.
    summary.stages.filesystemShell = await stageFilesystemAndShell(workspaceRoot);
    //> Source statement or expression.
    summary.stages.git = await stageGitFlow(gitRoot);
  //> Source statement or expression.
  } finally {
    //> Await async value.
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
    //> Await async value.
    await fsp.rm(gitRoot, { recursive: true, force: true });
    //> Source statement or expression.
    summary.stages.rollback = {
      //> Source statement or expression.
      workspaceRemoved: !(await exists(workspaceRoot)),
      //> Source statement or expression.
      gitRootRemoved: !(await exists(gitRoot))
    //> Brace or statement terminator.
    };
  //> Brace or statement terminator.
  }

  //> Source statement or expression.
  assert(summary.stages.rollback.workspaceRemoved, "workspace rollback cleanup failed");
  //> Source statement or expression.
  assert(summary.stages.rollback.gitRootRemoved, "git rollback cleanup failed");

  //> Source statement or expression.
  summary.durationMs = Date.now() - startedAt;
  //> Source statement or expression.
  console.log(JSON.stringify(summary, null, 2));
//> Brace or statement terminator.
}

//> Source statement or expression.
main().catch((error) => {
  //> Source statement or expression.
  console.error("[mvp-factory-control-e2e] failed:", error.message || error);
  //> Source statement or expression.
  process.exitCode = 1;
//> Brace or statement terminator.
});
