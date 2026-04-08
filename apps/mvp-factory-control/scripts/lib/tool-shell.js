/**
 * Worker implementation of shell.exec (spawn shell, timeouts, output size limits, cwd guards).
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
const MAX_TIMEOUT_MS = 120_000;
//> Variable declaration.
const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;
//> Variable declaration.
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
//> Variable declaration.
const DEFAULT_MAX_COMMAND_CHARS = 8_000;
//> Variable declaration.
const MAX_COMMAND_CHARS = 64_000;
//> Variable declaration.
const DEFAULT_CANCEL_POLL_MS = 500;
//> Variable declaration.
const DEFAULT_KILL_GRACE_MS = 1_500;
//> Variable declaration.
const DEFAULT_MAX_CPU_SECONDS = 30;
//> Variable declaration.
const DEFAULT_MAX_MEMORY_KB = 1_048_576;
//> Variable declaration.
const DEFAULT_MAX_PROCESS_COUNT = 0;
//> Variable declaration.
const DEFAULT_SHELL_BINARY = "/bin/sh";
//> Variable declaration.
const OUTPUT_PREVIEW_LIMIT = 1200;

//> Variable declaration.
const BASE_ENV_ALLOWLIST = [
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
  "COLORTERM",
  //> String literal line.
  "NO_COLOR",
  //> String literal line.
  "CI",
  //> String literal line.
  "PWD"
//> Delimiter or separator.
];

//> Source statement or expression.
class ToolShellError extends Error {
  //> Source statement or expression.
  constructor(code, message, metadata = {}) {
    //> Source statement or expression.
    super(message);
    //> Source statement or expression.
    this.name = "ToolShellError";
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
function parseKeyList(raw) {
  //> Conditional branch.
  if (!raw || typeof raw !== "string") return [];
  //> Return a value.
  return raw
    //> Source statement or expression.
    .split(/[,\s:]+/)
    //> Source statement or expression.
    .map((entry) => entry.trim().toUpperCase())
    //> Source statement or expression.
    .filter(Boolean);
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
function trimPreview(text, max = OUTPUT_PREVIEW_LIMIT) {
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
    throw new ToolShellError(
      //> String literal line.
      "WORKSPACE_UNAVAILABLE",
      //> String literal line.
      "Shell runtime requires at least one configured workspace root."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const roots = [];
  //> For-loop header.
  for (const root of workspaceRootsInput) {
    //> Variable declaration.
    const candidate = asTrimmed(root);
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
    throw new ToolShellError(
      //> String literal line.
      "WORKSPACE_UNAVAILABLE",
      //> String literal line.
      "Shell runtime could not validate workspace roots."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Return a value.
  return normalized;
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveWorkspaceCwd(workspaceRoots, candidatePath, operation) {
  //> Variable declaration.
  const resolvedCandidate = path.resolve(candidatePath);
  //> Variable declaration.
  const lexicalRoots = workspaceRoots.filter((root) => isWithinPath(resolvedCandidate, root));
  //> Conditional branch.
  if (!lexicalRoots.length) {
    //> Throw error.
    throw new ToolShellError(
      //> String literal line.
      "OUTSIDE_WORKSPACE",
      //> String literal line.
      `${operation} denied: cwd resolves outside configured workspace roots.`,
      //> Source statement or expression.
      { candidatePath: resolvedCandidate }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const stat = await fsp.stat(resolvedCandidate).catch(() => null);
  //> Conditional branch.
  if (!stat) {
    //> Throw error.
    throw new ToolShellError(
      //> String literal line.
      "CWD_NOT_FOUND",
      //> String literal line.
      `${operation} denied: cwd does not exist.`,
      //> Source statement or expression.
      { candidatePath: resolvedCandidate }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!stat.isDirectory()) {
    //> Throw error.
    throw new ToolShellError(
      //> String literal line.
      "CWD_NOT_DIRECTORY",
      //> String literal line.
      `${operation} denied: cwd must be a directory.`,
      //> Source statement or expression.
      { candidatePath: resolvedCandidate }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const real = await fsp.realpath(resolvedCandidate).catch(() => null);
  //> Conditional branch.
  if (!real) {
    //> Throw error.
    throw new ToolShellError(
      //> String literal line.
      "CWD_INVALID",
      //> String literal line.
      `${operation} denied: failed to resolve cwd.`,
      //> Source statement or expression.
      { candidatePath: resolvedCandidate }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const root = workspaceRoots.find((entry) => isWithinPath(real, entry));
  //> Conditional branch.
  if (!root) {
    //> Throw error.
    throw new ToolShellError(
      //> String literal line.
      "SYMLINK_ESCAPE",
      //> String literal line.
      `${operation} denied: cwd symlink escapes workspace boundary.`,
      //> Source statement or expression.
      { candidatePath: resolvedCandidate, resolvedPath: real }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Return a value.
  return {
    //> Source statement or expression.
    cwd: real,
    //> Source statement or expression.
    workspaceRoot: root,
    //> Source statement or expression.
    relativeCwd: path.relative(root, real) || "."
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function buildResourceLimits(env) {
  //> Return a value.
  return {
    //> Source statement or expression.
    defaultTimeoutMs: clampInt(
      //> Source statement or expression.
      env.MVP_FACTORY_CONTROL_SHELL_DEFAULT_TIMEOUT_MS,
      //> Source statement or expression.
      DEFAULT_TIMEOUT_MS,
      //> Source statement or expression.
      500,
      //> Source statement or expression.
      MAX_TIMEOUT_MS
    //> Delimiter or separator.
    ),
    //> Source statement or expression.
    maxTimeoutMs: clampInt(env.MVP_FACTORY_CONTROL_SHELL_MAX_TIMEOUT_MS, MAX_TIMEOUT_MS, 1_000, 600_000),
    //> Source statement or expression.
    maxOutputBytes: clampInt(
      //> Source statement or expression.
      env.MVP_FACTORY_CONTROL_SHELL_MAX_OUTPUT_BYTES,
      //> Source statement or expression.
      DEFAULT_MAX_OUTPUT_BYTES,
      //> Source statement or expression.
      4_096,
      //> Source statement or expression.
      MAX_OUTPUT_BYTES
    //> Delimiter or separator.
    ),
    //> Source statement or expression.
    maxCommandChars: clampInt(
      //> Source statement or expression.
      env.MVP_FACTORY_CONTROL_SHELL_MAX_COMMAND_CHARS,
      //> Source statement or expression.
      DEFAULT_MAX_COMMAND_CHARS,
      //> Source statement or expression.
      64,
      //> Source statement or expression.
      MAX_COMMAND_CHARS
    //> Delimiter or separator.
    ),
    //> Source statement or expression.
    cancelPollMs: clampInt(env.MVP_FACTORY_CONTROL_SHELL_CANCEL_POLL_MS, DEFAULT_CANCEL_POLL_MS, 100, 5_000),
    //> Source statement or expression.
    killGraceMs: clampInt(env.MVP_FACTORY_CONTROL_SHELL_KILL_GRACE_MS, DEFAULT_KILL_GRACE_MS, 200, 10_000),
    //> Source statement or expression.
    maxCpuSeconds: clampInt(env.MVP_FACTORY_CONTROL_SHELL_MAX_CPU_SECONDS, DEFAULT_MAX_CPU_SECONDS, 1, 3600),
    //> Source statement or expression.
    maxMemoryKb: clampInt(
      //> Source statement or expression.
      env.MVP_FACTORY_CONTROL_SHELL_MAX_MEMORY_KB,
      //> Source statement or expression.
      DEFAULT_MAX_MEMORY_KB,
      //> Source statement or expression.
      65_536,
      //> Source statement or expression.
      8_388_608
    //> Delimiter or separator.
    ),
    //> Source statement or expression.
    maxProcessCount: clampInt(
      //> Source statement or expression.
      env.MVP_FACTORY_CONTROL_SHELL_MAX_PROCESS_COUNT,
      //> Source statement or expression.
      DEFAULT_MAX_PROCESS_COUNT,
      //> Source statement or expression.
      0,
      //> Source statement or expression.
      4096
    //> Delimiter or separator.
    ),
    //> Source statement or expression.
    shellBinary: asTrimmed(env.MVP_FACTORY_CONTROL_SHELL_BINARY) || DEFAULT_SHELL_BINARY
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function buildAllowedEnvKeys(env) {
  //> Variable declaration.
  const extra = parseKeyList(env.MVP_FACTORY_CONTROL_SHELL_ENV_ALLOWLIST);
  //> Return a value.
  return unique([...BASE_ENV_ALLOWLIST, ...extra]);
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveShellToolContext(options = {}) {
  //> Variable declaration.
  const env = options.env || process.env;
  //> Variable declaration.
  const workspaceRoots = await ensureWorkspaceRoots(options.workspaceRoots);
  //> Variable declaration.
  const primaryWorkspaceRoot = workspaceRoots[0];
  //> Variable declaration.
  const defaultCwdInput = asTrimmed(options.defaultCwd) || primaryWorkspaceRoot;
  //> Variable declaration.
  const cwdInfo = await resolveWorkspaceCwd(
    //> Source statement or expression.
    workspaceRoots,
    //> Source statement or expression.
    defaultCwdInput,
    //> String literal line.
    "shell.exec context initialization"
  //> Delimiter or separator.
  );

  //> Variable declaration.
  const sessionId = asTrimmed(options.sessionId) || `task-${Date.now().toString(36)}`;
  //> Variable declaration.
  const sessionRootBase =
    //> Source statement or expression.
    asTrimmed(options.sessionRootBase) ||
    //> Source statement or expression.
    asTrimmed(env.MVP_FACTORY_CONTROL_SHELL_SESSION_ROOT) ||
    //> Source statement or expression.
    path.join(process.cwd(), ".mvp-factory-control", "shell-sessions");
  //> Variable declaration.
  const sessionRoot = path.resolve(sessionRootBase, sessionId);
  //> Await async value.
  await fsp.mkdir(sessionRoot, { recursive: true });

  //> Return a value.
  return {
    //> Source statement or expression.
    sessionId,
    //> Source statement or expression.
    sessionRoot,
    //> Source statement or expression.
    workspaceRoots,
    //> Source statement or expression.
    primaryWorkspaceRoot,
    //> Source statement or expression.
    currentCwd: cwdInfo.cwd,
    //> Source statement or expression.
    allowedEnvKeys: buildAllowedEnvKeys(env),
    //> Source statement or expression.
    limits: buildResourceLimits(env)
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function readCommand(call) {
  //> Variable declaration.
  const args = asRecord(call?.args) || {};
  //> Variable declaration.
  const command = asTrimmed(args.command) || asTrimmed(args.cmd);
  //> Conditional branch.
  if (!command) {
    //> Throw error.
    throw new ToolShellError(
      //> String literal line.
      "COMMAND_REQUIRED",
      //> String literal line.
      "shell.exec requires args.command (or args.cmd) to be a non-empty string."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Return a value.
  return command;
//> Brace or statement terminator.
}

//> Function declaration.
function readCommandLimits(call, context) {
  //> Variable declaration.
  const args = asRecord(call?.args) || {};
  //> Variable declaration.
  const requestedTimeout = args.timeoutMs;
  //> Variable declaration.
  const timeoutMs = clampInt(
    //> Source statement or expression.
    requestedTimeout,
    //> Source statement or expression.
    context.limits.defaultTimeoutMs,
    //> Source statement or expression.
    500,
    //> Source statement or expression.
    context.limits.maxTimeoutMs
  //> Delimiter or separator.
  );
  //> Return a value.
  return {
    //> Source statement or expression.
    timeoutMs,
    //> Source statement or expression.
    maxOutputBytes: context.limits.maxOutputBytes,
    //> Source statement or expression.
    maxCommandChars: context.limits.maxCommandChars
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function buildChildEnv(call, context, parentEnv) {
  //> Variable declaration.
  const args = asRecord(call?.args) || {};
  //> Variable declaration.
  const childEnv = {};
  //> For-loop header.
  for (const key of context.allowedEnvKeys) {
    //> Conditional branch.
    if (Object.prototype.hasOwnProperty.call(parentEnv, key) && parentEnv[key] != null) {
      //> Source statement or expression.
      childEnv[key] = String(parentEnv[key]);
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const overrides = asRecord(args.env);
  //> Conditional branch.
  if (!overrides) return childEnv;
  //> Variable declaration.
  const keys = Object.keys(overrides);
  //> Conditional branch.
  if (keys.length > 64) {
    //> Throw error.
    throw new ToolShellError(
      //> String literal line.
      "ENV_LIMIT_EXCEEDED",
      //> String literal line.
      "shell.exec denied: args.env may include at most 64 keys."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> For-loop header.
  for (const key of keys) {
    //> Conditional branch.
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)) {
      //> Throw error.
      throw new ToolShellError(
        //> String literal line.
        "ENV_KEY_INVALID",
        //> String literal line.
        `shell.exec denied: invalid env key "${key}".`
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const value = overrides[key];
    //> Conditional branch.
    if (value == null) continue;
    //> Source statement or expression.
    childEnv[key] = String(value).slice(0, 4096);
  //> Brace or statement terminator.
  }
  //> Return a value.
  return childEnv;
//> Brace or statement terminator.
}

//> Function declaration.
function buildShellScript(command, limits) {
  //> Variable declaration.
  const prelude = [];
  //> Conditional branch.
  if (limits.maxCpuSeconds > 0) {
    //> Source statement or expression.
    prelude.push(`ulimit -t ${limits.maxCpuSeconds} >/dev/null 2>&1 || true`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (limits.maxMemoryKb > 0) {
    //> Source statement or expression.
    prelude.push(`ulimit -v ${limits.maxMemoryKb} >/dev/null 2>&1 || true`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (limits.maxProcessCount > 0) {
    //> Source statement or expression.
    prelude.push(`ulimit -u ${limits.maxProcessCount} >/dev/null 2>&1 || true`);
  //> Brace or statement terminator.
  }
  //> Source statement or expression.
  prelude.push(command);
  //> Return a value.
  return prelude.join("; ");
//> Brace or statement terminator.
}

//> Function declaration.
function finalizeOutput(buffers, truncated) {
  //> Variable declaration.
  const text = Buffer.concat(buffers).toString("utf8");
  //> Return a value.
  return {
    //> Source statement or expression.
    text,
    //> Source statement or expression.
    preview: trimPreview(text),
    //> Source statement or expression.
    truncated
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Function declaration.
function emitOutputChunk(options, payload) {
  //> Conditional branch.
  if (typeof options?.onOutput !== "function") return;
  //> Try block start.
  try {
    //> Source statement or expression.
    options.onOutput(payload);
  //> Source statement or expression.
  } catch {
    // Streaming callback errors must not crash shell execution.
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Function declaration.
function mapShellErrorCode(code) {
  //> Conditional branch.
  if (code === "TASK_CANCELED") return code;
  //> Conditional branch.
  if (code === "TIMEOUT") return code;
  //> Conditional branch.
  if (code === "OUTPUT_LIMIT_EXCEEDED") return code;
  //> Conditional branch.
  if (code === "EXIT_NON_ZERO") return code;
  //> Return a value.
  return "EXECUTION_ERROR";
//> Brace or statement terminator.
}

//> Async function declaration.
async function executeShellToolCall(call, context, options = {}) {
  //> Conditional branch.
  if (!context || !Array.isArray(context.workspaceRoots) || !context.workspaceRoots.length) {
    //> Throw error.
    throw new ToolShellError(
      //> String literal line.
      "WORKSPACE_UNAVAILABLE",
      //> String literal line.
      "shell.exec denied: workspace context is unavailable."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const command = readCommand(call);
  //> Variable declaration.
  const commandLimits = readCommandLimits(call, context);
  //> Conditional branch.
  if (command.length > commandLimits.maxCommandChars) {
    //> Throw error.
    throw new ToolShellError(
      //> String literal line.
      "COMMAND_TOO_LONG",
      //> String literal line.
      `shell.exec denied: command length exceeds ${commandLimits.maxCommandChars} characters.`,
      //> Source statement or expression.
      { maxCommandChars: commandLimits.maxCommandChars, commandLength: command.length }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const args = asRecord(call?.args) || {};
  //> Variable declaration.
  const cwdInput = asTrimmed(args.cwd);
  //> Variable declaration.
  const baseCwd = context.currentCwd || context.primaryWorkspaceRoot;
  //> Variable declaration.
  const requestedCwd = cwdInput
    //> Source statement or expression.
    ? path.isAbsolute(cwdInput)
      //> Source statement or expression.
      ? path.resolve(cwdInput)
      //> Source statement or expression.
      : path.resolve(baseCwd, cwdInput)
    //> Source statement or expression.
    : baseCwd;
  //> Variable declaration.
  const cwdInfo = await resolveWorkspaceCwd(context.workspaceRoots, requestedCwd, "shell.exec");

  //> Variable declaration.
  const parentEnv = options.parentEnv || process.env;
  //> Variable declaration.
  const childEnv = buildChildEnv(call, context, parentEnv);
  //> Variable declaration.
  const script = buildShellScript(command, context.limits);

  //> Variable declaration.
  const stdoutBuffers = [];
  //> Variable declaration.
  const stderrBuffers = [];
  //> Variable declaration.
  let stdoutBytes = 0;
  //> Variable declaration.
  let stderrBytes = 0;
  //> Variable declaration.
  let totalBytes = 0;
  //> Variable declaration.
  let stdoutTruncated = false;
  //> Variable declaration.
  let stderrTruncated = false;
  //> Variable declaration.
  let terminated = false;
  //> Variable declaration.
  let timedOut = false;
  //> Variable declaration.
  let canceled = false;
  //> Variable declaration.
  let outputLimitExceeded = false;
  //> Variable declaration.
  const startedAt = Date.now();

  //> Variable declaration.
  const child = spawn(context.limits.shellBinary, ["-lc", script], {
    //> Source statement or expression.
    cwd: cwdInfo.cwd,
    //> Source statement or expression.
    env: childEnv,
    //> Source statement or expression.
    stdio: ["ignore", "pipe", "pipe"]
  //> Brace or statement terminator.
  });

  //> Const with function or expression.
  const stopProcess = (reasonCode) => {
    //> Conditional branch.
    if (terminated) return;
    //> Source statement or expression.
    terminated = true;
    //> Conditional branch.
    if (reasonCode === "TIMEOUT") timedOut = true;
    //> Conditional branch.
    if (reasonCode === "TASK_CANCELED") canceled = true;
    //> Conditional branch.
    if (reasonCode === "OUTPUT_LIMIT_EXCEEDED") outputLimitExceeded = true;
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
    }, context.limits.killGraceMs).unref();
  //> Brace or statement terminator.
  };

  //> Const with function or expression.
  const appendChunk = (streamName, chunk) => {
    //> Conditional branch.
    if (outputLimitExceeded) return;
    //> Variable declaration.
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk || ""));
    //> Conditional branch.
    if (buf.length === 0) return;
    //> Variable declaration.
    const remaining = commandLimits.maxOutputBytes - totalBytes;
    //> Conditional branch.
    if (remaining <= 0) {
      //> Conditional branch.
      if (streamName === "stdout") stdoutTruncated = true;
      //> Conditional branch.
      if (streamName === "stderr") stderrTruncated = true;
      //> Source statement or expression.
      stopProcess("OUTPUT_LIMIT_EXCEEDED");
      //> Return to caller.
      return;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const accepted = buf.length <= remaining ? buf : buf.subarray(0, remaining);
    //> Conditional branch.
    if (streamName === "stdout") {
      //> Source statement or expression.
      stdoutBuffers.push(accepted);
      //> Source statement or expression.
      stdoutBytes += accepted.length;
      //> Conditional branch.
      if (accepted.length < buf.length) stdoutTruncated = true;
    //> Source statement or expression.
    } else {
      //> Source statement or expression.
      stderrBuffers.push(accepted);
      //> Source statement or expression.
      stderrBytes += accepted.length;
      //> Conditional branch.
      if (accepted.length < buf.length) stderrTruncated = true;
    //> Brace or statement terminator.
    }
    //> Source statement or expression.
    totalBytes += accepted.length;
    //> Conditional branch.
    if (accepted.length > 0) {
      //> Source statement or expression.
      emitOutputChunk(options, {
        //> Source statement or expression.
        stream: streamName,
        //> Source statement or expression.
        text: accepted.toString("utf8"),
        //> Source statement or expression.
        bytes: accepted.length,
        //> Source statement or expression.
        totalBytes,
        //> Source statement or expression.
        truncated: accepted.length < buf.length
      //> Brace or statement terminator.
      });
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (accepted.length < buf.length) {
      //> Source statement or expression.
      stopProcess("OUTPUT_LIMIT_EXCEEDED");
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };

  //> Source statement or expression.
  child.stdout.on("data", (chunk) => appendChunk("stdout", chunk));
  //> Source statement or expression.
  child.stderr.on("data", (chunk) => appendChunk("stderr", chunk));

  //> Variable declaration.
  let cancelInterval = null;
  //> Conditional branch.
  if (typeof options.shouldCancel === "function") {
    //> Variable declaration.
    let checking = false;
    //> Source statement or expression.
    cancelInterval = setInterval(() => {
      //> Conditional branch.
      if (checking || terminated) return;
      //> Source statement or expression.
      checking = true;
      //> Source statement or expression.
      Promise.resolve(options.shouldCancel())
        //> Source statement or expression.
        .then((shouldCancel) => {
          //> Conditional branch.
          if (shouldCancel) stopProcess("TASK_CANCELED");
        //> Delimiter or separator.
        })
        //> Source statement or expression.
        .catch(() => {
          // Ignore cancel-check probe failures and continue command execution.
        //> Delimiter or separator.
        })
        //> Source statement or expression.
        .finally(() => {
          //> Source statement or expression.
          checking = false;
        //> Brace or statement terminator.
        });
    //> Source statement or expression.
    }, clampInt(options.cancelPollMs, context.limits.cancelPollMs, 100, 10_000));
    //> Source statement or expression.
    cancelInterval.unref();
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const timeoutTimer = setTimeout(() => {
    //> Source statement or expression.
    stopProcess("TIMEOUT");
  //> Source statement or expression.
  }, commandLimits.timeoutMs);
  //> Source statement or expression.
  timeoutTimer.unref();

  //> Variable declaration.
  const exitInfo = await new Promise((resolve, reject) => {
    //> Source statement or expression.
    child.once("error", reject);
    //> Source statement or expression.
    child.once("close", (code, signal) => resolve({ code, signal }));
  //> Source statement or expression.
  }).finally(() => {
    //> Source statement or expression.
    clearTimeout(timeoutTimer);
    //> Conditional branch.
    if (cancelInterval) clearInterval(cancelInterval);
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const stdout = finalizeOutput(stdoutBuffers, stdoutTruncated);
  //> Variable declaration.
  const stderr = finalizeOutput(stderrBuffers, stderrTruncated);
  //> Variable declaration.
  const durationMs = Date.now() - startedAt;
  //> Variable declaration.
  const metadata = {
    //> Source statement or expression.
    sessionId: context.sessionId,
    //> Source statement or expression.
    sessionRoot: context.sessionRoot,
    //> Source statement or expression.
    cwd: cwdInfo.cwd,
    //> Source statement or expression.
    workspaceRoot: cwdInfo.workspaceRoot,
    //> Source statement or expression.
    relativeCwd: cwdInfo.relativeCwd,
    //> Source statement or expression.
    command: trimPreview(command, 4000),
    //> Source statement or expression.
    timeoutMs: commandLimits.timeoutMs,
    //> Source statement or expression.
    durationMs,
    //> Source statement or expression.
    exitCode: Number.isInteger(exitInfo.code) ? exitInfo.code : null,
    //> Source statement or expression.
    signal: exitInfo.signal || null,
    //> Source statement or expression.
    stdoutBytes,
    //> Source statement or expression.
    stderrBytes,
    //> Source statement or expression.
    outputBytes: totalBytes,
    //> Source statement or expression.
    stdoutTruncated: stdout.truncated,
    //> Source statement or expression.
    stderrTruncated: stderr.truncated,
    //> Source statement or expression.
    timedOut,
    //> Source statement or expression.
    canceled,
    //> Source statement or expression.
    outputLimitExceeded,
    //> Source statement or expression.
    resourceLimits: {
      //> Source statement or expression.
      maxCpuSeconds: context.limits.maxCpuSeconds,
      //> Source statement or expression.
      maxMemoryKb: context.limits.maxMemoryKb,
      //> Source statement or expression.
      maxProcessCount: context.limits.maxProcessCount,
      //> Source statement or expression.
      maxOutputBytes: commandLimits.maxOutputBytes
    //> Brace or statement terminator.
    },
    //> Source statement or expression.
    stdoutPreview: stdout.preview || null,
    //> Source statement or expression.
    stderrPreview: stderr.preview || null
  //> Brace or statement terminator.
  };

  //> Conditional branch.
  if (canceled) {
    //> Throw error.
    throw new ToolShellError(
      //> Source statement or expression.
      mapShellErrorCode("TASK_CANCELED"),
      //> String literal line.
      "shell.exec canceled because task status changed to CANCELED.",
      //> Source statement or expression.
      metadata
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (timedOut) {
    //> Throw error.
    throw new ToolShellError(
      //> Source statement or expression.
      mapShellErrorCode("TIMEOUT"),
      //> String literal line.
      `shell.exec timed out after ${commandLimits.timeoutMs}ms.`,
      //> Source statement or expression.
      metadata
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (outputLimitExceeded) {
    //> Throw error.
    throw new ToolShellError(
      //> Source statement or expression.
      mapShellErrorCode("OUTPUT_LIMIT_EXCEEDED"),
      //> String literal line.
      `shell.exec output exceeded ${commandLimits.maxOutputBytes} bytes and was terminated.`,
      //> Source statement or expression.
      metadata
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!Number.isInteger(exitInfo.code) || exitInfo.code !== 0) {
    //> Variable declaration.
    const failurePreview = stderr.preview || stdout.preview || "no output";
    //> Throw error.
    throw new ToolShellError(
      //> Source statement or expression.
      mapShellErrorCode("EXIT_NON_ZERO"),
      //> String literal line.
      `shell.exec exited with code ${exitInfo.code ?? "unknown"} (${failurePreview}).`,
      //> Source statement or expression.
      metadata
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Source statement or expression.
  context.currentCwd = cwdInfo.cwd;
  //> Return a value.
  return {
    //> Source statement or expression.
    answer:
      //> String literal line.
      `shell.exec cwd=${cwdInfo.relativeCwd} exit=0 stdout=${stdout.preview || "(empty)"} ` +
      //> String literal line.
      `stderr=${stderr.preview || "(empty)"}`,
    //> Source statement or expression.
    audit: metadata,
    //> Source statement or expression.
    output: {
      //> Source statement or expression.
      stdout: stdout.text,
      //> Source statement or expression.
      stderr: stderr.text
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Source statement or expression.
module.exports = {
  //> Source statement or expression.
  ToolShellError,
  //> Source statement or expression.
  resolveShellToolContext,
  //> Source statement or expression.
  executeShellToolCall
//> Brace or statement terminator.
};
