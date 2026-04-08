/**
 * Worker implementation of git.* tool calls (spawn git with timeouts, branch allowlists, output caps).
 */
//> Variable declaration.
const fsp = require("node:fs/promises");
//> Variable declaration.
const path = require("node:path");
//> Variable declaration.
const { spawn } = require("node:child_process");

//> Variable declaration.
const DEFAULT_TIMEOUT_MS = 20_000;
//> Variable declaration.
const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;
//> Variable declaration.
const DEFAULT_MAX_ARGUMENTS = 32;
//> Variable declaration.
const DEFAULT_PROTECTED_BRANCHES = ["main", "master", "production"];
//> Variable declaration.
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,120}$/;

//> Source statement or expression.
class ToolGitError extends Error {
  //> Source statement or expression.
  constructor(code, message, metadata = {}) {
    //> Source statement or expression.
    super(message);
    //> Source statement or expression.
    this.name = "ToolGitError";
    //> Source statement or expression.
    this.code = code;
    //> Source statement or expression.
    this.metadata = metadata;
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function asRecord(value) {
  //> Conditional branch.
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  //> Return a value.
  return value;
//> Brace or statement terminator.
}

//> Function declaration.
function asTrimmed(value) {
  //> Return a value.
  return typeof value === "string" ? value.trim() : "";
//> Brace or statement terminator.
}

//> Function declaration.
function asBoolean(value, fallback = false) {
  //> Conditional branch.
  if (typeof value === "boolean") return value;
  //> Conditional branch.
  if (typeof value === "string") {
    //> Variable declaration.
    const lowered = value.trim().toLowerCase();
    //> Conditional branch.
    if (lowered === "true" || lowered === "1" || lowered === "yes") return true;
    //> Conditional branch.
    if (lowered === "false" || lowered === "0" || lowered === "no") return false;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return fallback;
//> Brace or statement terminator.
}

//> Function declaration.
function clampInt(value, fallback, min, max) {
  //> Variable declaration.
  const n = Number(value);
  //> Conditional branch.
  if (!Number.isFinite(n)) return fallback;
  //> Return a value.
  return Math.min(Math.max(Math.trunc(n), min), max);
//> Brace or statement terminator.
}

//> Function declaration.
function unique(values) {
  //> Return a value.
  return Array.from(new Set(values));
//> Brace or statement terminator.
}

//> Function declaration.
function isWithinPath(candidate, root) {
  //> Variable declaration.
  const rel = path.relative(root, candidate);
  //> Return a value.
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
//> Brace or statement terminator.
}

//> Function declaration.
function parseProtectedBranches(raw) {
  //> Conditional branch.
  if (!raw || typeof raw !== "string") return DEFAULT_PROTECTED_BRANCHES;
  //> Variable declaration.
  const parsed = raw
    //> Source statement or expression.
    .split(/[,\s]+/)
    //> Source statement or expression.
    .map((entry) => entry.trim())
    //> Source statement or expression.
    .filter(Boolean);
  //> Return a value.
  return parsed.length ? parsed : DEFAULT_PROTECTED_BRANCHES;
//> Brace or statement terminator.
}

//> Function declaration.
function trimPreview(text, max = 1200) {
  //> Variable declaration.
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  //> Conditional branch.
  if (normalized.length <= max) return normalized;
  //> Return a value.
  return `${normalized.slice(0, max)}...`;
//> Brace or statement terminator.
}

//> Async function declaration.
async function ensureWorkspaceRoots(workspaceRootsInput) {
  //> Conditional branch.
  if (!Array.isArray(workspaceRootsInput) || !workspaceRootsInput.length) {
    //> Throw error.
    throw new ToolGitError(
      //> String literal line.
      "WORKSPACE_UNAVAILABLE",
      //> String literal line.
      "Git runtime requires workspace roots from execution context."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const roots = [];
  //> For-loop header.
  for (const entry of workspaceRootsInput) {
    //> Variable declaration.
    const candidate = asTrimmed(entry);
    //> Conditional branch.
    if (!candidate) continue;
    //> Variable declaration.
    const resolved = path.resolve(candidate);
    //> Variable declaration.
    const stat = await fsp.stat(resolved).catch(() => null);
    //> Conditional branch.
    if (!stat || !stat.isDirectory()) continue;
    //> Variable declaration.
    const real = await fsp.realpath(resolved).catch(() => null);
    //> Conditional branch.
    if (real) roots.push(real);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const normalized = unique(roots);
  //> Conditional branch.
  if (!normalized.length) {
    //> Throw error.
    throw new ToolGitError("WORKSPACE_UNAVAILABLE", "Git runtime could not resolve workspace roots.");
  //> Brace or statement terminator.
  }
  //> Return a value.
  return normalized;
//> Brace or statement terminator.
}

//> Function declaration.
function buildGitEnv(parentEnv) {
  //> Variable declaration.
  const env = {};
  //> Variable declaration.
  const keys = [
    //> String literal line.
    "PATH",
    //> String literal line.
    "HOME",
    //> String literal line.
    "USER",
    //> String literal line.
    "LOGNAME",
    //> String literal line.
    "SHELL",
    //> String literal line.
    "TMPDIR",
    //> String literal line.
    "TEMP",
    //> String literal line.
    "TMP",
    //> String literal line.
    "LANG",
    //> String literal line.
    "LC_ALL",
    //> String literal line.
    "TERM",
    //> String literal line.
    "GIT_TERMINAL_PROMPT"
  //> Delimiter or separator.
  ];
  //> For-loop header.
  for (const key of keys) {
    //> Conditional branch.
    if (Object.prototype.hasOwnProperty.call(parentEnv, key) && parentEnv[key] != null) {
      //> Source statement or expression.
      env[key] = String(parentEnv[key]);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }
  //> Source statement or expression.
  env.GIT_TERMINAL_PROMPT = "0";
  //> Return a value.
  return env;
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitCommand(commandArgs, options) {
  //> Variable declaration.
  const cwd = options.cwd;
  //> Variable declaration.
  const timeoutMs = options.timeoutMs;
  //> Variable declaration.
  const maxOutputBytes = options.maxOutputBytes;
  //> Variable declaration.
  const parentEnv = options.parentEnv || process.env;
  //> Variable declaration.
  const env = { ...buildGitEnv(parentEnv), ...(options.envOverrides || {}) };
  //> Variable declaration.
  const args = Array.isArray(commandArgs) ? commandArgs : [];
  //> Conditional branch.
  if (!args.length) {
    //> Throw error.
    throw new ToolGitError("ARGS_REQUIRED", "Git command requires at least one argument.");
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (args.length > DEFAULT_MAX_ARGUMENTS) {
    //> Throw error.
    throw new ToolGitError(
      //> String literal line.
      "ARGS_LIMIT_EXCEEDED",
      //> String literal line.
      `Git command denied: more than ${DEFAULT_MAX_ARGUMENTS} arguments provided.`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const startedAt = Date.now();
  //> Variable declaration.
  const stdoutChunks = [];
  //> Variable declaration.
  const stderrChunks = [];
  //> Variable declaration.
  let totalBytes = 0;
  //> Variable declaration.
  let outputTruncated = false;
  //> Variable declaration.
  let timedOut = false;
  //> Variable declaration.
  let terminated = false;

  //> Variable declaration.
  const child = spawn("git", args, {
    //> Source statement or expression.
    cwd,
    //> Source statement or expression.
    env,
    //> Source statement or expression.
    stdio: ["ignore", "pipe", "pipe"]
  //> Brace or statement terminator.
  });

  //> Const with function or expression.
  const stopProcess = (reason) => {
    //> Conditional branch.
    if (terminated) return;
    //> Source statement or expression.
    terminated = true;
    //> Conditional branch.
    if (reason === "TIMEOUT") timedOut = true;
    //> Conditional branch.
    if (reason === "OUTPUT_LIMIT") outputTruncated = true;
    //> Source statement or expression.
    child.kill("SIGTERM");
    //> Source statement or expression.
    setTimeout(() => {
      //> Conditional branch.
      if (child.exitCode == null && child.signalCode == null) {
        //> Source statement or expression.
        child.kill("SIGKILL");
      //> Brace or statement terminator.
      }
    //> Source statement or expression.
    }, 1200).unref();
  //> Brace or statement terminator.
  };

  //> Const with function or expression.
  const appendChunk = (target, chunk) => {
    //> Conditional branch.
    if (outputTruncated) return;
    //> Variable declaration.
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk || ""));
    //> Conditional branch.
    if (!buf.length) return;
    //> Variable declaration.
    const remaining = maxOutputBytes - totalBytes;
    //> Conditional branch.
    if (remaining <= 0) {
      //> Source statement or expression.
      stopProcess("OUTPUT_LIMIT");
      //> Return to caller.
      return;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const accepted = buf.length <= remaining ? buf : buf.subarray(0, remaining);
    //> Conditional branch.
    if (accepted.length > 0) target.push(accepted);
    //> Source statement or expression.
    totalBytes += accepted.length;
    //> Conditional branch.
    if (accepted.length < buf.length) stopProcess("OUTPUT_LIMIT");
  //> Brace or statement terminator.
  };

  //> Source statement or expression.
  child.stdout.on("data", (chunk) => appendChunk(stdoutChunks, chunk));
  //> Source statement or expression.
  child.stderr.on("data", (chunk) => appendChunk(stderrChunks, chunk));

  //> Variable declaration.
  const timeoutTimer = setTimeout(() => {
    //> Source statement or expression.
    stopProcess("TIMEOUT");
  //> Source statement or expression.
  }, timeoutMs);
  //> Source statement or expression.
  timeoutTimer.unref();

  //> Variable declaration.
  const exit = await new Promise((resolve, reject) => {
    //> Source statement or expression.
    child.once("error", reject);
    //> Source statement or expression.
    child.once("close", (code, signal) => resolve({ code, signal }));
  //> Source statement or expression.
  }).finally(() => {
    //> Source statement or expression.
    clearTimeout(timeoutTimer);
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const stdout = Buffer.concat(stdoutChunks).toString("utf8");
  //> Variable declaration.
  const stderr = Buffer.concat(stderrChunks).toString("utf8");
  //> Variable declaration.
  const durationMs = Date.now() - startedAt;
  //> Variable declaration.
  const metadata = {
    //> Source statement or expression.
    args,
    //> Source statement or expression.
    cwd,
    //> Source statement or expression.
    timeoutMs,
    //> Source statement or expression.
    durationMs,
    //> Source statement or expression.
    outputBytes: totalBytes,
    //> Source statement or expression.
    outputTruncated,
    //> Source statement or expression.
    timedOut,
    //> Source statement or expression.
    exitCode: Number.isInteger(exit.code) ? exit.code : null,
    //> Source statement or expression.
    signal: exit.signal || null,
    //> Source statement or expression.
    stdoutPreview: trimPreview(stdout),
    //> Source statement or expression.
    stderrPreview: trimPreview(stderr)
  //> Brace or statement terminator.
  };

  //> Conditional branch.
  if (timedOut) {
    //> Throw error.
    throw new ToolGitError(
      //> String literal line.
      "TIMEOUT",
      //> String literal line.
      `Git command timed out after ${timeoutMs}ms: git ${args.join(" ")}`,
      //> Source statement or expression.
      metadata
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (outputTruncated) {
    //> Throw error.
    throw new ToolGitError(
      //> String literal line.
      "OUTPUT_LIMIT_EXCEEDED",
      //> String literal line.
      `Git command output exceeded ${maxOutputBytes} bytes and was terminated.`,
      //> Source statement or expression.
      metadata
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!Number.isInteger(exit.code) || exit.code !== 0) {
    //> Variable declaration.
    const summary = trimPreview(stderr || stdout || "no output", 300);
    //> Throw error.
    throw new ToolGitError(
      //> String literal line.
      "GIT_COMMAND_FAILED",
      //> String literal line.
      `git ${args.join(" ")} failed with exit code ${exit.code ?? "unknown"} (${summary}).`,
      //> Source statement or expression.
      metadata
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    stdout,
    //> Source statement or expression.
    stderr,
    //> Source statement or expression.
    audit: metadata
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveRepoRoot(context, call) {
  //> Variable declaration.
  const args = asRecord(call?.args) || {};
  //> Variable declaration.
  const repoPathRaw = asTrimmed(args.repoPath) || asTrimmed(args.cwd) || context.primaryWorkspaceRoot;
  //> Variable declaration.
  const candidate = path.isAbsolute(repoPathRaw)
    //> Source statement or expression.
    ? path.resolve(repoPathRaw)
    //> Source statement or expression.
    : path.resolve(context.primaryWorkspaceRoot, repoPathRaw);
  //> Variable declaration.
  const candidateReal = await fsp.realpath(candidate).catch(() => null);
  //> Conditional branch.
  if (!candidateReal) {
    //> Throw error.
    throw new ToolGitError(
      //> String literal line.
      "REPO_PATH_MISSING",
      //> String literal line.
      `Git tool denied: path does not exist (${repoPathRaw}).`,
      //> Source statement or expression.
      { repoPath: repoPathRaw }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const withinWorkspace = context.workspaceRoots.some((root) => isWithinPath(candidateReal, root));
  //> Conditional branch.
  if (!withinWorkspace) {
    //> Throw error.
    throw new ToolGitError(
      //> String literal line.
      "OUTSIDE_WORKSPACE",
      //> String literal line.
      "Git tool denied: repo path resolves outside workspace roots.",
      //> Source statement or expression.
      { repoPath: repoPathRaw }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const resolved = await runGitCommand(["rev-parse", "--show-toplevel"], {
    //> Source statement or expression.
    cwd: candidateReal,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const repoRootRaw = asTrimmed(resolved.stdout);
  //> Variable declaration.
  const repoRoot = repoRootRaw ? await fsp.realpath(repoRootRaw).catch(() => null) : null;
  //> Conditional branch.
  if (!repoRoot) {
    //> Throw error.
    throw new ToolGitError("NOT_A_REPOSITORY", "Git tool denied: could not resolve repository root.");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const repoWithinWorkspace = context.workspaceRoots.some((root) => isWithinPath(repoRoot, root));
  //> Conditional branch.
  if (!repoWithinWorkspace) {
    //> Throw error.
    throw new ToolGitError(
      //> String literal line.
      "OUTSIDE_WORKSPACE",
      //> String literal line.
      "Git tool denied: repository root resolves outside workspace roots.",
      //> Source statement or expression.
      { repoRoot }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Return a value.
  return repoRoot;
//> Brace or statement terminator.
}

//> Async function declaration.
async function getCurrentBranch(repoRoot, context) {
  //> Try block start.
  try {
    //> Variable declaration.
    const result = await runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"], {
      //> Source statement or expression.
      cwd: repoRoot,
      //> Source statement or expression.
      timeoutMs: context.timeoutMs,
      //> Source statement or expression.
      maxOutputBytes: context.maxOutputBytes,
      //> Source statement or expression.
      parentEnv: context.env
    //> Brace or statement terminator.
    });
    //> Return a value.
    return asTrimmed(result.stdout) || "unknown";
  //> Source statement or expression.
  } catch (error) {
    //> Conditional branch.
    if (!(error instanceof ToolGitError) || error.code !== "GIT_COMMAND_FAILED") {
      //> Throw error.
      throw error;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const fallback = await runGitCommand(["symbolic-ref", "--short", "HEAD"], {
      //> Source statement or expression.
      cwd: repoRoot,
      //> Source statement or expression.
      timeoutMs: context.timeoutMs,
      //> Source statement or expression.
      maxOutputBytes: context.maxOutputBytes,
      //> Source statement or expression.
      parentEnv: context.env
    //> Brace or statement terminator.
    });
    //> Return a value.
    return asTrimmed(fallback.stdout) || "unknown";
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function enforceBranchName(branch, operation) {
  //> Conditional branch.
  if (!branch || !BRANCH_RE.test(branch)) {
    //> Throw error.
    throw new ToolGitError(
      //> String literal line.
      "BRANCH_INVALID",
      //> String literal line.
      `${operation} denied: branch name is missing or invalid.`,
      //> Source statement or expression.
      { branch }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function enforceNotProtectedBranch(branch, context, operation) {
  //> Variable declaration.
  const normalized = asTrimmed(branch);
  //> Conditional branch.
  if (!normalized) return;
  //> Conditional branch.
  if (context.protectedBranches.has(normalized)) {
    //> Throw error.
    throw new ToolGitError(
      //> String literal line.
      "PROTECTED_BRANCH_DENIED",
      //> String literal line.
      `${operation} denied: protected branch "${normalized}" is blocked for mutation.`,
      //> Source statement or expression.
      { branch: normalized }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function normalizePathspec(args) {
  //> Variable declaration.
  const raw = args.pathspec ?? args.path ?? ".";
  //> Conditional branch.
  if (Array.isArray(raw)) {
    //> Variable declaration.
    const cleaned = raw.map((entry) => asTrimmed(entry)).filter(Boolean);
    //> Conditional branch.
    if (!cleaned.length) return ["."];
    //> Return a value.
    return cleaned.slice(0, 16);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const single = asTrimmed(raw);
  //> Return a value.
  return [single || "."];
//> Brace or statement terminator.
}

//> Function declaration.
function buildAudit(base, result, extra = {}) {
  //> Return a value.
  return {
    //> Source statement or expression.
    ...extra,
    //> Source statement or expression.
    repoRoot: base.repoRoot,
    //> Source statement or expression.
    branch: base.branch,
    //> Source statement or expression.
    ...(result?.audit || {})
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function extractGitHubPullInfo(json) {
  //> Return a value.
  return {
    //> Source statement or expression.
    number: json?.number ?? null,
    //> Source statement or expression.
    url: json?.html_url ?? null,
    //> Source statement or expression.
    state: json?.state ?? null
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function createPullRequest(context, args, repoRoot, headBranch) {
  //> Conditional branch.
  if (!context.githubToken) {
    //> Throw error.
    throw new ToolGitError("TOKEN_MISSING", "git.pr.create denied: MVP_FACTORY_CONTROL_GITHUB_TOKEN is missing.");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const title = asTrimmed(args.title);
  //> Conditional branch.
  if (!title) {
    //> Throw error.
    throw new ToolGitError("TITLE_REQUIRED", "git.pr.create requires args.title.");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const body = asTrimmed(args.body);
  //> Variable declaration.
  const base = asTrimmed(args.base) || "main";
  //> Variable declaration.
  const head = asTrimmed(args.head) || headBranch;
  //> Source statement or expression.
  enforceBranchName(base, "git.pr.create");
  //> Source statement or expression.
  enforceBranchName(head, "git.pr.create");
  //> Source statement or expression.
  enforceNotProtectedBranch(head, context, "git.pr.create");
  //> Variable declaration.
  const controller = new AbortController();
  //> Variable declaration.
  const timer = setTimeout(() => controller.abort(), context.timeoutMs);
  //> Try block start.
  try {
    //> Variable declaration.
    const res = await fetch(
      //> String literal line.
      `https://api.github.com/repos/${context.repoOwner}/${context.repoName}/pulls`,
      //> Brace or statement terminator.
      {
        //> Source statement or expression.
        method: "POST",
        //> Source statement or expression.
        headers: {
          //> Source statement or expression.
          Authorization: `Bearer ${context.githubToken}`,
          //> Source statement or expression.
          Accept: "application/vnd.github+json",
          //> String literal line.
          "Content-Type": "application/json",
          //> String literal line.
          "X-GitHub-Api-Version": "2022-11-28"
        //> Brace or statement terminator.
        },
        //> Source statement or expression.
        body: JSON.stringify({
          //> Source statement or expression.
          title,
          //> Source statement or expression.
          body: body || undefined,
          //> Source statement or expression.
          base,
          //> Source statement or expression.
          head,
          //> Source statement or expression.
          draft: asBoolean(args.draft, false)
        //> Delimiter or separator.
        }),
        //> Source statement or expression.
        signal: controller.signal
      //> Brace or statement terminator.
      }
    //> Delimiter or separator.
    );
    //> Variable declaration.
    const responseText = await res.text();
    //> Variable declaration.
    let json = null;
    //> Try block start.
    try {
      //> Source statement or expression.
      json = responseText ? JSON.parse(responseText) : null;
    //> Source statement or expression.
    } catch {
      //> Source statement or expression.
      json = null;
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (!res.ok) {
      //> Throw error.
      throw new ToolGitError(
        //> String literal line.
        "PR_CREATE_FAILED",
        //> String literal line.
        `git.pr.create failed with HTTP ${res.status}.`,
        //> Brace or statement terminator.
        {
          //> Source statement or expression.
          status: res.status,
          //> Source statement or expression.
          responsePreview: trimPreview(responseText, 400),
          //> Source statement or expression.
          repoRoot
        //> Brace or statement terminator.
        }
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    }
    //> Return a value.
    return extractGitHubPullInfo(json);
  //> Source statement or expression.
  } catch (error) {
    //> Conditional branch.
    if (error?.name === "AbortError") {
      //> Throw error.
      throw new ToolGitError(
        //> String literal line.
        "TIMEOUT",
        //> String literal line.
        `git.pr.create timed out after ${context.timeoutMs}ms.`,
        //> Source statement or expression.
        { repoRoot }
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (error instanceof ToolGitError) throw error;
    //> Throw error.
    throw new ToolGitError("PR_CREATE_FAILED", `git.pr.create failed: ${error.message}`, {
      //> Source statement or expression.
      repoRoot
    //> Brace or statement terminator.
    });
  //> Source statement or expression.
  } finally {
    //> Source statement or expression.
    clearTimeout(timer);
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitStatus(repoRoot, context) {
  //> Variable declaration.
  const result = await runGitCommand(["status", "--short", "--branch"], {
    //> Source statement or expression.
    cwd: repoRoot,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const branch = await getCurrentBranch(repoRoot, context);
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `git.status branch=${branch} ${trimPreview(result.stdout || "clean", 800)}`,
    //> Source statement or expression.
    audit: buildAudit({ repoRoot, branch }, result, {
      //> Source statement or expression.
      operation: "git.status"
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitDiff(repoRoot, context, args) {
  //> Variable declaration.
  const staged = asBoolean(args.staged, false);
  //> Variable declaration.
  const command = ["diff"];
  //> Conditional branch.
  if (staged) command.push("--staged");
  //> Variable declaration.
  const pathspec = asTrimmed(args.path);
  //> Conditional branch.
  if (pathspec) command.push("--", pathspec);
  //> Variable declaration.
  const result = await runGitCommand(command, {
    //> Source statement or expression.
    cwd: repoRoot,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const branch = await getCurrentBranch(repoRoot, context);
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `git.diff branch=${branch} ${trimPreview(result.stdout || "no diff", 800)}`,
    //> Source statement or expression.
    audit: buildAudit({ repoRoot, branch }, result, {
      //> Source statement or expression.
      operation: "git.diff",
      //> Source statement or expression.
      staged
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitLog(repoRoot, context, args) {
  //> Variable declaration.
  const limit = clampInt(args.limit, 10, 1, 50);
  //> Variable declaration.
  const result = await runGitCommand(["log", "--oneline", `-${limit}`], {
    //> Source statement or expression.
    cwd: repoRoot,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const branch = await getCurrentBranch(repoRoot, context);
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `git.log branch=${branch} limit=${limit}\n${trimPreview(result.stdout, 1500)}`,
    //> Source statement or expression.
    audit: buildAudit({ repoRoot, branch }, result, {
      //> Source statement or expression.
      operation: "git.log",
      //> Source statement or expression.
      limit
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitShow(repoRoot, context, args) {
  //> Variable declaration.
  const ref = asTrimmed(args.ref) || "HEAD";
  //> Variable declaration.
  const result = await runGitCommand(["show", "--stat", "--oneline", ref], {
    //> Source statement or expression.
    cwd: repoRoot,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const branch = await getCurrentBranch(repoRoot, context);
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `git.show ref=${ref}\n${trimPreview(result.stdout, 1500)}`,
    //> Source statement or expression.
    audit: buildAudit({ repoRoot, branch }, result, {
      //> Source statement or expression.
      operation: "git.show",
      //> Source statement or expression.
      ref
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitBranchList(repoRoot, context) {
  //> Variable declaration.
  const result = await runGitCommand(["branch", "--list", "--verbose", "--no-abbrev"], {
    //> Source statement or expression.
    cwd: repoRoot,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const branch = await getCurrentBranch(repoRoot, context);
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `git.branch.list current=${branch}\n${trimPreview(result.stdout, 1500)}`,
    //> Source statement or expression.
    audit: buildAudit({ repoRoot, branch }, result, {
      //> Source statement or expression.
      operation: "git.branch.list"
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitAdd(repoRoot, context, args) {
  //> Variable declaration.
  const branch = await getCurrentBranch(repoRoot, context);
  //> Source statement or expression.
  enforceNotProtectedBranch(branch, context, "git.add");
  //> Variable declaration.
  const pathspec = normalizePathspec(args);
  //> Variable declaration.
  const command = asBoolean(args.all, false)
    //> Source statement or expression.
    ? ["add", "--all"]
    //> Source statement or expression.
    : ["add", "--", ...pathspec];
  //> Variable declaration.
  const result = await runGitCommand(command, {
    //> Source statement or expression.
    cwd: repoRoot,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `git.add branch=${branch} paths=${pathspec.join(",") || "."}`,
    //> Source statement or expression.
    audit: buildAudit({ repoRoot, branch }, result, {
      //> Source statement or expression.
      operation: "git.add",
      //> Source statement or expression.
      pathspec
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitCommit(repoRoot, context, args) {
  //> Variable declaration.
  const branch = await getCurrentBranch(repoRoot, context);
  //> Source statement or expression.
  enforceNotProtectedBranch(branch, context, "git.commit");
  //> Variable declaration.
  const message = asTrimmed(args.message);
  //> Conditional branch.
  if (!message) {
    //> Throw error.
    throw new ToolGitError("COMMIT_MESSAGE_REQUIRED", "git.commit requires args.message.");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const commitArgs = ["commit", "-m", message];
  //> Variable declaration.
  const authorName = asTrimmed(args.authorName);
  //> Variable declaration.
  const authorEmail = asTrimmed(args.authorEmail);
  //> Conditional branch.
  if (authorName && authorEmail) {
    //> Source statement or expression.
    commitArgs.push("--author", `${authorName} <${authorEmail}>`);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const commitResult = await runGitCommand(commitArgs, {
    //> Source statement or expression.
    cwd: repoRoot,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const shaResult = await runGitCommand(["rev-parse", "HEAD"], {
    //> Source statement or expression.
    cwd: repoRoot,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const commitSha = asTrimmed(shaResult.stdout);
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `git.commit branch=${branch} sha=${commitSha}`,
    //> Source statement or expression.
    audit: buildAudit({ repoRoot, branch }, commitResult, {
      //> Source statement or expression.
      operation: "git.commit",
      //> Source statement or expression.
      commitSha
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitCheckout(repoRoot, context, args) {
  //> Variable declaration.
  const branch = asTrimmed(args.branch);
  //> Variable declaration.
  const create = asBoolean(args.create, false);
  //> Source statement or expression.
  enforceBranchName(branch, "git.checkout");
  //> Source statement or expression.
  enforceNotProtectedBranch(branch, context, "git.checkout");
  //> Variable declaration.
  const command = ["checkout"];
  //> Conditional branch.
  if (create) {
    //> Source statement or expression.
    command.push("-b", branch);
    //> Variable declaration.
    const startPoint = asTrimmed(args.startPoint);
    //> Conditional branch.
    if (startPoint) command.push(startPoint);
  //> Source statement or expression.
  } else {
    //> Source statement or expression.
    command.push(branch);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const result = await runGitCommand(command, {
    //> Source statement or expression.
    cwd: repoRoot,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const currentBranch = await getCurrentBranch(repoRoot, context);
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `git.checkout branch=${currentBranch} create=${create}`,
    //> Source statement or expression.
    audit: buildAudit({ repoRoot, branch: currentBranch }, result, {
      //> Source statement or expression.
      operation: "git.checkout",
      //> Source statement or expression.
      targetBranch: branch,
      //> Source statement or expression.
      create
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitPush(repoRoot, context, args) {
  //> Variable declaration.
  const currentBranch = await getCurrentBranch(repoRoot, context);
  //> Variable declaration.
  const branch = asTrimmed(args.branch) || currentBranch;
  //> Source statement or expression.
  enforceBranchName(branch, "git.push");
  //> Source statement or expression.
  enforceNotProtectedBranch(branch, context, "git.push");
  //> Variable declaration.
  const remote = asTrimmed(args.remote) || "origin";
  //> Variable declaration.
  const command = ["push"];
  //> Conditional branch.
  if (asBoolean(args.setUpstream, false)) command.push("--set-upstream");
  //> Source statement or expression.
  command.push(remote, branch);
  //> Variable declaration.
  const result = await runGitCommand(command, {
    //> Source statement or expression.
    cwd: repoRoot,
    //> Source statement or expression.
    timeoutMs: context.timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.maxOutputBytes,
    //> Source statement or expression.
    parentEnv: context.env
  //> Brace or statement terminator.
  });
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `git.push remote=${remote} branch=${branch}`,
    //> Source statement or expression.
    audit: buildAudit({ repoRoot, branch }, result, {
      //> Source statement or expression.
      operation: "git.push",
      //> Source statement or expression.
      remote
    //> Delimiter or separator.
    })
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runGitPrCreate(repoRoot, context, args) {
  //> Variable declaration.
  const headBranch = await getCurrentBranch(repoRoot, context);
  //> Source statement or expression.
  enforceNotProtectedBranch(headBranch, context, "git.pr.create");
  //> Variable declaration.
  const pr = await createPullRequest(context, args, repoRoot, headBranch);
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `git.pr.create number=${pr.number ?? "unknown"} url=${pr.url ?? "n/a"}`,
    //> Source statement or expression.
    audit: {
      //> Source statement or expression.
      operation: "git.pr.create",
      //> Source statement or expression.
      repoRoot,
      //> Source statement or expression.
      branch: headBranch,
      //> Source statement or expression.
      prNumber: pr.number,
      //> Source statement or expression.
      prUrl: pr.url,
      //> Source statement or expression.
      prState: pr.state
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function executeGitToolCall(call, context) {
  //> Conditional branch.
  if (!call || !call.tool) {
    //> Throw error.
    throw new ToolGitError("CALL_REQUIRED", "Git tool call payload is missing.");
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const args = asRecord(call.args) || {};
  //> Variable declaration.
  const repoRoot = await resolveRepoRoot(context, call);

  //> Conditional branch.
  if (call.tool === "git.status") return runGitStatus(repoRoot, context);
  //> Conditional branch.
  if (call.tool === "git.diff") return runGitDiff(repoRoot, context, args);
  //> Conditional branch.
  if (call.tool === "git.log") return runGitLog(repoRoot, context, args);
  //> Conditional branch.
  if (call.tool === "git.show") return runGitShow(repoRoot, context, args);
  //> Conditional branch.
  if (call.tool === "git.branch.list") return runGitBranchList(repoRoot, context);
  //> Conditional branch.
  if (call.tool === "git.add") return runGitAdd(repoRoot, context, args);
  //> Conditional branch.
  if (call.tool === "git.commit") return runGitCommit(repoRoot, context, args);
  //> Conditional branch.
  if (call.tool === "git.checkout") return runGitCheckout(repoRoot, context, args);
  //> Conditional branch.
  if (call.tool === "git.push") return runGitPush(repoRoot, context, args);
  //> Conditional branch.
  if (call.tool === "git.pr.create") return runGitPrCreate(repoRoot, context, args);

  //> Throw error.
  throw new ToolGitError(
    //> String literal line.
    "UNSUPPORTED_TOOL",
    //> String literal line.
    `Git runtime does not support ${call.tool} in this phase.`
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveGitToolContext(options = {}) {
  //> Variable declaration.
  const env = options.env || process.env;
  //> Variable declaration.
  const workspaceRoots = await ensureWorkspaceRoots(options.workspaceRoots);
  //> Return a value.
  return {
    //> Source statement or expression.
    workspaceRoots,
    //> Source statement or expression.
    primaryWorkspaceRoot: options.primaryWorkspaceRoot || workspaceRoots[0],
    //> Source statement or expression.
    timeoutMs: clampInt(env.MVP_FACTORY_CONTROL_GIT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 120_000),
    //> Source statement or expression.
    maxOutputBytes: clampInt(
      //> Source statement or expression.
      env.MVP_FACTORY_CONTROL_GIT_MAX_OUTPUT_BYTES,
      //> Source statement or expression.
      DEFAULT_MAX_OUTPUT_BYTES,
      //> Source statement or expression.
      4_096,
      //> Source statement or expression.
      1_048_576
    //> Delimiter or separator.
    ),
    //> Source statement or expression.
    protectedBranches: new Set(parseProtectedBranches(env.MVP_FACTORY_CONTROL_GIT_PROTECTED_BRANCHES)),
    //> Source statement or expression.
    env,
    //> Source statement or expression.
    repoOwner: asTrimmed(env.MVP_FACTORY_CONTROL_GITHUB_REPO_OWNER) || "moldovancsaba",
    //> Source statement or expression.
    repoName: asTrimmed(env.MVP_FACTORY_CONTROL_GITHUB_REPO_NAME) || "mvp-factory-control",
    //> Source statement or expression.
    githubToken:
      //> Source statement or expression.
      asTrimmed(env.MVP_FACTORY_CONTROL_GITHUB_TOKEN) ||
      //> Source statement or expression.
      asTrimmed(env.GITHUB_TOKEN) ||
      //> Source statement or expression.
      asTrimmed(env.MVP_PROJECT_TOKEN)
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Source statement or expression.
module.exports = {
  //> Source statement or expression.
  ToolGitError,
  //> Source statement or expression.
  resolveGitToolContext,
  //> Source statement or expression.
  executeGitToolCall
//> Brace or statement terminator.
};
