#!/usr/bin/env node
/* eslint-disable no-console */
const os = require("node:os");
const path = require("node:path");
const fsp = require("node:fs/promises");
const { spawnSync } = require("node:child_process");
const { validateToolCallProtocolEnvelope } = require("../lib/tool-call-protocol");
const { evaluateToolCommandPolicy } = require("../lib/tool-command-policy");
const { resolveFilesystemToolContext, executeFilesystemToolCall } = require("../lib/tool-filesystem");
const { resolveShellToolContext, executeShellToolCall } = require("../lib/tool-shell");
const { resolveGitToolContext, executeGitToolCall, ToolGitError } = require("../lib/tool-git");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run(cmd, args, cwd) {
  const out = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (out.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${out.stderr || out.stdout}`);
  }
}

async function exists(absPath) {
  const stat = await fsp.stat(absPath).catch(() => null);
  return Boolean(stat);
}

async function stageToolCallProtocol() {
  const envelope = {
    protocol: "warroom.tool-call",
    version: "1.0",
    mode: "SEQUENTIAL",
    calls: [
      {
        id: "e2e-chat",
        tool: "chat.respond",
        args: { prompt: "status" },
        riskClass: "LOW",
        approval: "NONE"
      },
      {
        id: "e2e-shell",
        tool: "shell.exec",
        args: { command: "echo e2e-shell" },
        riskClass: "CRITICAL",
        approval: "HUMAN_APPROVAL"
      },
      {
        id: "e2e-git",
        tool: "git.status",
        args: {},
        riskClass: "MEDIUM",
        approval: "NONE"
      }
    ]
  };

  const validation = validateToolCallProtocolEnvelope(envelope);
  assert(validation.present && validation.ok, "tool-call protocol validation failed");
  const policy = evaluateToolCommandPolicy(validation.envelope);
  assert(policy.allowed, "tool-command policy denied e2e envelope");
  assert(policy.requiresApproval, "tool-command policy should require approval for shell.exec");
  return {
    protocolOk: validation.ok,
    policyAllowed: policy.allowed,
    policyRequiresApproval: policy.requiresApproval,
    highestRiskClass: policy.highestRiskClass
  };
}

async function stageFilesystemAndShell(workspaceRoot) {
  const fsContext = await resolveFilesystemToolContext({
    cwd: workspaceRoot,
    env: { WARROOM_WORKSPACE_ROOT: workspaceRoot }
  });

  await executeFilesystemToolCall(
    {
      tool: "filesystem.write",
      args: { path: "rehearsal/e2e.txt", content: "warroom-e2e" }
    },
    fsContext
  );
  const readResult = await executeFilesystemToolCall(
    {
      tool: "filesystem.read",
      args: { path: "rehearsal/e2e.txt" }
    },
    fsContext
  );
  assert(readResult.answer.includes("warroom-e2e"), "filesystem read/write stage failed");

  const streamEvents = [];
  const shellContext = await resolveShellToolContext({
    sessionId: `e2e-${Date.now().toString(36)}`,
    workspaceRoots: fsContext.workspaceRoots,
    defaultCwd: workspaceRoot,
    env: process.env
  });
  const shellResult = await executeShellToolCall(
    {
      tool: "shell.exec",
      args: { command: "printf 'shell-e2e-out\\n'; printf 'shell-e2e-err\\n' 1>&2" }
    },
    shellContext,
    {
      onOutput: (event) => streamEvents.push(event)
    }
  );
  assert(shellResult.audit.exitCode === 0, "shell stage returned non-zero exit");
  assert(streamEvents.length >= 1, "shell streaming callback did not emit output");

  return {
    filesystemOk: true,
    shellExitCode: shellResult.audit.exitCode,
    shellStreamEventCount: streamEvents.length,
    artifactSessionId: shellResult.audit.sessionId
  };
}

async function stageGitFlow(tempRoot) {
  const repo = path.join(tempRoot, "repo");
  const remote = path.join(tempRoot, "remote.git");
  await fsp.mkdir(repo, { recursive: true });
  run("git", ["init"], repo);
  run("git", ["config", "user.name", "WarRoom E2E"], repo);
  run("git", ["config", "user.email", "warroom-e2e@example.com"], repo);

  await fsp.writeFile(path.join(repo, "README.md"), "# warroom e2e\n", "utf8");

  const gitContext = await resolveGitToolContext({
    workspaceRoots: [tempRoot],
    primaryWorkspaceRoot: tempRoot,
    env: process.env
  });
  const statusResult = await executeGitToolCall(
    { tool: "git.status", args: { repoPath: repo } },
    gitContext
  );
  assert(Boolean(statusResult.audit?.repoRoot), "git.status did not return repo metadata");

  let protectedBranchCode = "none";
  try {
    await executeGitToolCall(
      { tool: "git.checkout", args: { repoPath: repo, branch: "main" } },
      gitContext
    );
  } catch (error) {
    if (error instanceof ToolGitError) {
      protectedBranchCode = error.code;
    } else {
      throw error;
    }
  }
  assert(
    protectedBranchCode === "PROTECTED_BRANCH_DENIED",
    "protected-branch guard was not enforced"
  );

  await executeGitToolCall(
    { tool: "git.checkout", args: { repoPath: repo, branch: "feature/e2e", create: true } },
    gitContext
  );
  await executeGitToolCall(
    { tool: "git.add", args: { repoPath: repo, pathspec: ["README.md"] } },
    gitContext
  );
  const commitResult = await executeGitToolCall(
    {
      tool: "git.commit",
      args: { repoPath: repo, message: "e2e: commit rehearsal file" }
    },
    gitContext
  );
  assert(Boolean(commitResult.audit?.commitSha), "git.commit did not return commit SHA");

  run("git", ["init", "--bare", remote], tempRoot);
  run("git", ["remote", "add", "origin", remote], repo);
  const pushResult = await executeGitToolCall(
    {
      tool: "git.push",
      args: { repoPath: repo, remote: "origin", branch: "feature/e2e", setUpstream: true }
    },
    gitContext
  );
  assert(pushResult.answer.includes("git.push"), "git.push stage failed");

  return {
    gitStatusOk: true,
    protectedBranchGuard: protectedBranchCode,
    commitSha: commitResult.audit.commitSha,
    pushOk: true
  };
}

async function main() {
  const startedAt = Date.now();
  const summary = {
    runId: `warroom-e2e-${new Date().toISOString()}`,
    stages: {}
  };

  const workspaceRaw = await fsp.mkdtemp(path.join(os.tmpdir(), "warroom-e2e-workspace-"));
  const gitRaw = await fsp.mkdtemp(path.join(os.tmpdir(), "warroom-e2e-git-"));
  const workspaceRoot = await fsp.realpath(workspaceRaw);
  const gitRoot = await fsp.realpath(gitRaw);

  try {
    summary.stages.protocol = await stageToolCallProtocol();
    summary.stages.filesystemShell = await stageFilesystemAndShell(workspaceRoot);
    summary.stages.git = await stageGitFlow(gitRoot);
  } finally {
    await fsp.rm(workspaceRoot, { recursive: true, force: true });
    await fsp.rm(gitRoot, { recursive: true, force: true });
    summary.stages.rollback = {
      workspaceRemoved: !(await exists(workspaceRoot)),
      gitRootRemoved: !(await exists(gitRoot))
    };
  }

  assert(summary.stages.rollback.workspaceRemoved, "workspace rollback cleanup failed");
  assert(summary.stages.rollback.gitRootRemoved, "git rollback cleanup failed");

  summary.durationMs = Date.now() - startedAt;
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[warroom-e2e] failed:", error.message || error);
  process.exitCode = 1;
});
