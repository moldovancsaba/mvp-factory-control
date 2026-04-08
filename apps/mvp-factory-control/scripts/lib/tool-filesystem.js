/**
 * Worker implementation of filesystem.* tool calls (read/write/search within allowed repo roots).
 * Behavior must match expectations of `src/lib` worker integration and policy classes.
 */
//> Variable declaration.
const fs = require("node:fs");
//> Variable declaration.
const fsp = require("node:fs/promises");
//> Variable declaration.
const path = require("node:path");
//> Variable declaration.
const crypto = require("node:crypto");

//> Variable declaration.
const DEFAULT_MAX_TEXT_BYTES = 256 * 1024;
//> Variable declaration.
const DEFAULT_MAX_WRITE_BYTES = 256 * 1024;
//> Variable declaration.
const DEFAULT_MAX_SEARCH_RESULTS = 200;
//> Variable declaration.
const DEFAULT_MAX_SEARCH_BYTES = 256 * 1024;
//> Variable declaration.
const DEFAULT_MAX_LIST_ENTRIES = 500;
//> Variable declaration.
const DEFAULT_MAX_SEARCH_FILES = 1000;

//> Variable declaration.
const BINARY_EXTENSIONS = new Set([
  //> String literal line.
  ".png",
  //> String literal line.
  ".jpg",
  //> String literal line.
  ".jpeg",
  //> String literal line.
  ".gif",
  //> String literal line.
  ".webp",
  //> String literal line.
  ".ico",
  //> String literal line.
  ".bmp",
  //> String literal line.
  ".pdf",
  //> String literal line.
  ".zip",
  //> String literal line.
  ".gz",
  //> String literal line.
  ".tgz",
  //> String literal line.
  ".7z",
  //> String literal line.
  ".rar",
  //> String literal line.
  ".jar",
  //> String literal line.
  ".wasm",
  //> String literal line.
  ".mp3",
  //> String literal line.
  ".mp4",
  //> String literal line.
  ".avi",
  //> String literal line.
  ".mov",
  //> String literal line.
  ".wav",
  //> String literal line.
  ".ogg",
  //> String literal line.
  ".woff",
  //> String literal line.
  ".woff2",
  //> String literal line.
  ".ttf",
  //> String literal line.
  ".otf",
  //> String literal line.
  ".eot",
  //> String literal line.
  ".exe",
  //> String literal line.
  ".dll",
  //> String literal line.
  ".so",
  //> String literal line.
  ".dylib",
  //> String literal line.
  ".bin",
  //> String literal line.
  ".class"
//> Delimiter or separator.
]);

//> Variable declaration.
const SECRET_PATH_PATTERNS = [
  //> Source statement or expression.
  /(^|\/)\.env(\.|$)/i,
  //> Source statement or expression.
  /(^|\/)\.env$/i,
  //> Source statement or expression.
  /(^|\/).*\.pem$/i,
  //> Source statement or expression.
  /(^|\/).*\.p12$/i,
  //> Source statement or expression.
  /(^|\/).*\.key$/i,
  //> Source statement or expression.
  /(^|\/)id_rsa(\.pub)?$/i,
  //> Source statement or expression.
  /(^|\/)id_ed25519(\.pub)?$/i
//> Delimiter or separator.
];

//> Source statement or expression.
class ToolFilesystemError extends Error {
  //> Source statement or expression.
  constructor(code, message, metadata = {}) {
    //> Source statement or expression.
    super(message);
    //> Source statement or expression.
    this.name = "ToolFilesystemError";
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
    if (lowered === "1" || lowered === "true" || lowered === "yes") return true;
    //> Conditional branch.
    if (lowered === "0" || lowered === "false" || lowered === "no") return false;
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
function hashContent(text) {
  //> Return a value.
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
//> Brace or statement terminator.
}

//> Function declaration.
function unique(items) {
  //> Return a value.
  return Array.from(new Set(items));
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
function isLikelyBinaryBuffer(buffer) {
  //> Conditional branch.
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;
  //> Variable declaration.
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  //> Variable declaration.
  let nonPrintable = 0;
  //> For-loop header.
  for (const byte of sample) {
    //> Conditional branch.
    if (byte === 0) return true;
    //> Conditional branch.
    if (byte < 7 || (byte > 14 && byte < 32)) nonPrintable += 1;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return nonPrintable / sample.length > 0.3;
//> Brace or statement terminator.
}

//> Function declaration.
function classifyFileByName(absPath) {
  //> Variable declaration.
  const ext = path.extname(absPath || "").toLowerCase();
  //> Return a value.
  return BINARY_EXTENSIONS.has(ext) ? "BINARY" : "TEXT";
//> Brace or statement terminator.
}

//> Function declaration.
function parseWorkspaceEnvList(rawValue) {
  //> Conditional branch.
  if (!rawValue || typeof rawValue !== "string") return [];
  //> Return a value.
  return rawValue
    //> Source statement or expression.
    .split(path.delimiter)
    //> Source statement or expression.
    .map((entry) => entry.trim())
    //> Source statement or expression.
    .filter(Boolean);
//> Brace or statement terminator.
}

//> Async function declaration.
async function readSettingsWorkspaceRoot(settingsFile) {
  //> Conditional branch.
  if (!settingsFile) return "";
  //> Try block start.
  try {
    //> Variable declaration.
    const raw = await fsp.readFile(settingsFile, "utf8");
    //> Variable declaration.
    const parsed = JSON.parse(raw);
    //> Return a value.
    return asTrimmed(parsed?.localProjectFolder);
  //> Source statement or expression.
  } catch {
    //> Return a value.
    return "";
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveWorkspaceRoots(options) {
  //> Variable declaration.
  const cwd = path.resolve(asTrimmed(options?.cwd) || process.cwd());
  //> Variable declaration.
  const env = options?.env || process.env;
  //> Variable declaration.
  const envRoots = parseWorkspaceEnvList(
    //> Source statement or expression.
    asTrimmed(env?.MVP_FACTORY_CONTROL_WORKSPACE_ROOT) || asTrimmed(env?.MVP_FACTORY_CONTROL_LOCAL_PROJECT_ROOT)
  //> Delimiter or separator.
  );
  //> Variable declaration.
  const settingsRoot = await readSettingsWorkspaceRoot(asTrimmed(options?.settingsFile));
  //> Variable declaration.
  const rawRoots = unique([...envRoots, settingsRoot, cwd].filter(Boolean));

  //> Variable declaration.
  const normalized = [];
  //> For-loop header.
  for (const root of rawRoots) {
    //> Try block start.
    try {
      //> Variable declaration.
      const abs = path.resolve(root);
      //> Variable declaration.
      const stat = await fsp.stat(abs);
      //> Conditional branch.
      if (!stat.isDirectory()) continue;
      //> Variable declaration.
      const real = await fsp.realpath(abs);
      //> Source statement or expression.
      normalized.push(real);
    //> Source statement or expression.
    } catch {
      // Ignore invalid roots.
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const deduped = unique(normalized);
  //> Conditional branch.
  if (!deduped.length) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "WORKSPACE_UNAVAILABLE",
      //> String literal line.
      "No accessible workspace root is configured for filesystem tools."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Return a value.
  return deduped;
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveExistingAncestor(absPath) {
  //> Variable declaration.
  let probe = absPath;
  //> While-loop header.
  while (true) {
    //> Try block start.
    try {
      //> Variable declaration.
      const real = await fsp.realpath(probe);
      //> Return a value.
      return { probe, real };
    //> Source statement or expression.
    } catch {
      // Continue climbing.
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const parent = path.dirname(probe);
    //> Conditional branch.
    if (parent === probe) break;
    //> Source statement or expression.
    probe = parent;
  //> Brace or statement terminator.
  }
  //> Return a value.
  return null;
//> Brace or statement terminator.
}

//> Function declaration.
function hasSecretPathPattern(relativePath) {
  //> Return a value.
  return SECRET_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveTargetPath(args) {
  //> Variable declaration.
  const {
    //> Source statement or expression.
    workspaceRoots,
    //> Source statement or expression.
    requestedPath,
    //> Source statement or expression.
    allowCreate = false,
    //> Source statement or expression.
    requireExisting = false,
    //> Source statement or expression.
    operation
  //> Source statement or expression.
  } = args;
  //> Conditional branch.
  if (!asTrimmed(requestedPath)) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "PATH_REQUIRED",
      //> String literal line.
      `${operation} requires args.path to be a non-empty string.`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const primaryRoot = workspaceRoots[0];
  //> Variable declaration.
  const candidateAbsolute = path.isAbsolute(requestedPath)
    //> Source statement or expression.
    ? path.resolve(requestedPath)
    //> Source statement or expression.
    : path.resolve(primaryRoot, requestedPath);

  //> Variable declaration.
  const lexicalMatches = workspaceRoots.filter((root) => isWithinPath(candidateAbsolute, root));
  //> Conditional branch.
  if (!lexicalMatches.length) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "OUTSIDE_WORKSPACE",
      //> String literal line.
      `${operation} denied: path resolves outside configured workspace roots.`,
      //> Source statement or expression.
      { requestedPath, candidateAbsolute }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> For-loop header.
  for (const workspaceRoot of lexicalMatches) {
    //> Try block start.
    try {
      //> Variable declaration.
      const lstat = await fsp.lstat(candidateAbsolute).catch(() => null);
      //> Conditional branch.
      if (lstat) {
        //> Conditional branch.
        if (lstat.isSymbolicLink()) {
          //> Throw error.
          throw new ToolFilesystemError(
            //> String literal line.
            "SYMLINK_DENIED",
            //> String literal line.
            `${operation} denied: direct symlink targets are blocked.`,
            //> Source statement or expression.
            { requestedPath, candidateAbsolute }
          //> Delimiter or separator.
          );
        //> Brace or statement terminator.
        }
        //> Variable declaration.
        const real = await fsp.realpath(candidateAbsolute);
        //> Conditional branch.
        if (!isWithinPath(real, workspaceRoot)) {
          //> Throw error.
          throw new ToolFilesystemError(
            //> String literal line.
            "SYMLINK_ESCAPE",
            //> String literal line.
            `${operation} denied: resolved path escapes workspace boundary.`,
            //> Source statement or expression.
            { requestedPath, candidateAbsolute, resolvedPath: real }
          //> Delimiter or separator.
          );
        //> Brace or statement terminator.
        }
        //> Variable declaration.
        const relativePath = path.relative(workspaceRoot, real);
        //> Return a value.
        return {
          //> Source statement or expression.
          workspaceRoot,
          //> Source statement or expression.
          absolutePath: real,
          //> Source statement or expression.
          relativePath,
          //> Source statement or expression.
          exists: true,
          //> Source statement or expression.
          lstat
        //> Brace or statement terminator.
        };
      //> Brace or statement terminator.
      }

      //> Conditional branch.
      if (requireExisting) {
        //> Throw error.
        throw new ToolFilesystemError(
          //> String literal line.
          "PATH_NOT_FOUND",
          //> String literal line.
          `${operation} denied: target path does not exist.`,
          //> Source statement or expression.
          { requestedPath, candidateAbsolute }
        //> Delimiter or separator.
        );
      //> Brace or statement terminator.
      }
      //> Conditional branch.
      if (!allowCreate) {
        //> Throw error.
        throw new ToolFilesystemError(
          //> String literal line.
          "PATH_NOT_FOUND",
          //> String literal line.
          `${operation} denied: target path does not exist.`,
          //> Source statement or expression.
          { requestedPath, candidateAbsolute }
        //> Delimiter or separator.
        );
      //> Brace or statement terminator.
      }

      //> Variable declaration.
      const ancestor = await resolveExistingAncestor(candidateAbsolute);
      //> Conditional branch.
      if (!ancestor) {
        //> Throw error.
        throw new ToolFilesystemError(
          //> String literal line.
          "PATH_INVALID",
          //> String literal line.
          `${operation} denied: could not resolve an existing ancestor within workspace.`,
          //> Source statement or expression.
          { requestedPath, candidateAbsolute }
        //> Delimiter or separator.
        );
      //> Brace or statement terminator.
      }
      //> Conditional branch.
      if (!isWithinPath(ancestor.real, workspaceRoot)) {
        //> Throw error.
        throw new ToolFilesystemError(
          //> String literal line.
          "SYMLINK_ESCAPE",
          //> String literal line.
          `${operation} denied: ancestor path escapes workspace boundary.`,
          //> Source statement or expression.
          { requestedPath, candidateAbsolute, ancestorPath: ancestor.real }
        //> Delimiter or separator.
        );
      //> Brace or statement terminator.
      }
      //> Variable declaration.
      const relativePath = path.relative(workspaceRoot, candidateAbsolute);
      //> Return a value.
      return {
        //> Source statement or expression.
        workspaceRoot,
        //> Source statement or expression.
        absolutePath: candidateAbsolute,
        //> Source statement or expression.
        relativePath,
        //> Source statement or expression.
        exists: false,
        //> Source statement or expression.
        lstat: null
      //> Brace or statement terminator.
      };
    //> Source statement or expression.
    } catch (error) {
      //> Conditional branch.
      if (error instanceof ToolFilesystemError) throw error;
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Throw error.
  throw new ToolFilesystemError(
    //> String literal line.
    "OUTSIDE_WORKSPACE",
    //> String literal line.
    `${operation} denied: target path could not be validated against workspace roots.`,
    //> Source statement or expression.
    { requestedPath, candidateAbsolute }
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Function declaration.
function enforceNonSecretPath(relativePath, operation) {
  //> Conditional branch.
  if (hasSecretPathPattern(relativePath)) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "SENSITIVE_PATH_DENIED",
      //> String literal line.
      `${operation} denied: sensitive file path class is blocked.`,
      //> Source statement or expression.
      { relativePath }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
//> Brace or statement terminator.
}

//> Async function declaration.
async function ensureTextReadableFile(target, args, operation) {
  //> Conditional branch.
  if (!target.exists) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "PATH_NOT_FOUND",
      //> String literal line.
      `${operation} denied: target file does not exist.`,
      //> Source statement or expression.
      { relativePath: target.relativePath }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!target.lstat || !target.lstat.isFile()) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "NOT_A_FILE",
      //> String literal line.
      `${operation} denied: target path must be a regular file.`,
      //> Source statement or expression.
      { relativePath: target.relativePath }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Source statement or expression.
  enforceNonSecretPath(target.relativePath, operation);
  //> Variable declaration.
  const maxBytes = clampInt(args?.maxBytes, DEFAULT_MAX_TEXT_BYTES, 1024, 4 * 1024 * 1024);
  //> Conditional branch.
  if (target.lstat.size > maxBytes) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "FILE_TOO_LARGE",
      //> String literal line.
      `${operation} denied: file exceeds size limit (${maxBytes} bytes).`,
      //> Source statement or expression.
      { relativePath: target.relativePath, sizeBytes: target.lstat.size, maxBytes }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const buffer = await fsp.readFile(target.absolutePath);
  //> Variable declaration.
  const classByName = classifyFileByName(target.absolutePath);
  //> Variable declaration.
  const classByContent = isLikelyBinaryBuffer(buffer) ? "BINARY" : "TEXT";
  //> Conditional branch.
  if (classByName === "BINARY" || classByContent === "BINARY") {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "BINARY_DENIED",
      //> String literal line.
      `${operation} denied: binary file class is not permitted for this operation.`,
      //> Source statement or expression.
      { relativePath: target.relativePath, classByName, classByContent }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Return a value.
  return {
    //> Source statement or expression.
    text: buffer.toString("utf8"),
    //> Source statement or expression.
    sizeBytes: buffer.length
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runFilesystemList(call, context) {
  //> Variable declaration.
  const args = asRecord(call.args) || {};
  //> Variable declaration.
  const target = await resolveTargetPath({
    //> Source statement or expression.
    workspaceRoots: context.workspaceRoots,
    //> Source statement or expression.
    requestedPath: asTrimmed(args.path) || ".",
    //> Source statement or expression.
    allowCreate: false,
    //> Source statement or expression.
    requireExisting: true,
    //> Source statement or expression.
    operation: call.tool
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!target.lstat || !target.lstat.isDirectory()) {
    //> Throw error.
    throw new ToolFilesystemError("NOT_A_DIRECTORY", `${call.tool} requires a directory path.`, {
      //> Source statement or expression.
      relativePath: target.relativePath
    //> Brace or statement terminator.
    });
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const recursive = asBoolean(args.recursive, false);
  //> Variable declaration.
  const includeHidden = asBoolean(args.includeHidden, false);
  //> Variable declaration.
  const maxDepth = recursive ? clampInt(args.maxDepth, 4, 1, 10) : 1;
  //> Variable declaration.
  const maxEntries = clampInt(args.maxEntries, DEFAULT_MAX_LIST_ENTRIES, 1, 5000);

  //> Variable declaration.
  const queue = [{ abs: target.absolutePath, rel: target.relativePath || ".", depth: 0 }];
  //> Variable declaration.
  const entries = [];
  //> Variable declaration.
  let truncated = false;
  //> While-loop header.
  while (queue.length) {
    //> Variable declaration.
    const current = queue.shift();
    //> Variable declaration.
    const children = await fsp.readdir(current.abs, { withFileTypes: true });
    //> For-loop header.
    for (const child of children) {
      //> Conditional branch.
      if (!includeHidden && child.name.startsWith(".")) continue;
      //> Variable declaration.
      const absChild = path.join(current.abs, child.name);
      //> Variable declaration.
      const relChild = path.relative(target.workspaceRoot, absChild);
      //> Variable declaration.
      const isSymlink = child.isSymbolicLink();
      //> Variable declaration.
      const kind = child.isDirectory()
        //> Source statement or expression.
        ? "dir"
        //> Source statement or expression.
        : child.isFile()
        //> Source statement or expression.
        ? "file"
        //> Source statement or expression.
        : isSymlink
        //> Source statement or expression.
        ? "symlink"
        //> Source statement or expression.
        : "other";
      //> Source statement or expression.
      entries.push({ path: relChild, kind });
      //> Conditional branch.
      if (entries.length >= maxEntries) {
        //> Source statement or expression.
        truncated = true;
        //> Source statement or expression.
        break;
      //> Brace or statement terminator.
      }
      //> Conditional branch.
      if (recursive && child.isDirectory() && !isSymlink && current.depth + 1 < maxDepth) {
        //> Source statement or expression.
        queue.push({ abs: absChild, rel: relChild, depth: current.depth + 1 });
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (truncated) break;
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const summaryLines = entries.slice(0, 80).map((entry) => `${entry.kind.padEnd(7)} ${entry.path}`);
  //> Variable declaration.
  const suffix = truncated ? `\n... truncated at ${maxEntries} entries.` : "";
  //> Return a value.
  return {
    //> Source statement or expression.
    answer:
      //> String literal line.
      `filesystem.list ${target.relativePath || "."} (${entries.length} entries)` +
      //> String literal line.
      `\n${summaryLines.join("\n")}${suffix}`,
    //> Source statement or expression.
    audit: {
      //> Source statement or expression.
      operation: call.tool,
      //> Source statement or expression.
      relativePath: target.relativePath || ".",
      //> Source statement or expression.
      recursive,
      //> Source statement or expression.
      maxDepth,
      //> Source statement or expression.
      entryCount: entries.length,
      //> Source statement or expression.
      truncated
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runFilesystemRead(call, context) {
  //> Variable declaration.
  const args = asRecord(call.args) || {};
  //> Variable declaration.
  const target = await resolveTargetPath({
    //> Source statement or expression.
    workspaceRoots: context.workspaceRoots,
    //> Source statement or expression.
    requestedPath: asTrimmed(args.path),
    //> Source statement or expression.
    allowCreate: false,
    //> Source statement or expression.
    requireExisting: true,
    //> Source statement or expression.
    operation: call.tool
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const loaded = await ensureTextReadableFile(target, args, call.tool);
  //> Variable declaration.
  const maxOutputChars = clampInt(args.maxOutputChars, 12000, 256, 200000);
  //> Variable declaration.
  const truncated = loaded.text.length > maxOutputChars;
  //> Variable declaration.
  const content = truncated ? `${loaded.text.slice(0, maxOutputChars)}\n...[truncated]` : loaded.text;
  //> Return a value.
  return {
    //> Source statement or expression.
    answer:
      //> String literal line.
      `filesystem.read ${target.relativePath} (${loaded.sizeBytes} bytes, sha256=${hashContent(loaded.text)})\n` +
      //> String literal line.
      "----- file content -----\n" +
      //> Source statement or expression.
      content,
    //> Source statement or expression.
    audit: {
      //> Source statement or expression.
      operation: call.tool,
      //> Source statement or expression.
      relativePath: target.relativePath,
      //> Source statement or expression.
      sizeBytes: loaded.sizeBytes,
      //> Source statement or expression.
      truncated
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runFilesystemSearch(call, context) {
  //> Variable declaration.
  const args = asRecord(call.args) || {};
  //> Variable declaration.
  const query = asTrimmed(args.query);
  //> Conditional branch.
  if (!query) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "QUERY_REQUIRED",
      //> String literal line.
      `${call.tool} requires args.query to be a non-empty string.`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const caseSensitive = asBoolean(args.caseSensitive, false);
  //> Variable declaration.
  const needle = caseSensitive ? query : query.toLowerCase();
  //> Variable declaration.
  const maxResults = clampInt(args.maxResults, DEFAULT_MAX_SEARCH_RESULTS, 1, 2000);
  //> Variable declaration.
  const maxBytesPerFile = clampInt(args.maxBytesPerFile, DEFAULT_MAX_SEARCH_BYTES, 512, 4 * 1024 * 1024);
  //> Variable declaration.
  const maxFiles = clampInt(args.maxFiles, DEFAULT_MAX_SEARCH_FILES, 1, 10000);

  //> Variable declaration.
  const target = await resolveTargetPath({
    //> Source statement or expression.
    workspaceRoots: context.workspaceRoots,
    //> Source statement or expression.
    requestedPath: asTrimmed(args.path) || ".",
    //> Source statement or expression.
    allowCreate: false,
    //> Source statement or expression.
    requireExisting: true,
    //> Source statement or expression.
    operation: call.tool
  //> Brace or statement terminator.
  });

  //> Variable declaration.
  const files = [];
  //> Conditional branch.
  if (target.lstat && target.lstat.isFile()) {
    //> Source statement or expression.
    files.push(target.absolutePath);
  //> Source statement or expression.
  } else if (target.lstat && target.lstat.isDirectory()) {
    //> Variable declaration.
    const stack = [target.absolutePath];
    //> While-loop header.
    while (stack.length && files.length < maxFiles) {
      //> Variable declaration.
      const dir = stack.pop();
      //> Variable declaration.
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      //> For-loop header.
      for (const entry of entries) {
        //> Variable declaration.
        const abs = path.join(dir, entry.name);
        //> Conditional branch.
        if (entry.isSymbolicLink()) continue;
        //> Conditional branch.
        if (entry.isDirectory()) {
          //> Source statement or expression.
          stack.push(abs);
          //> Source statement or expression.
          continue;
        //> Brace or statement terminator.
        }
        //> Conditional branch.
        if (entry.isFile()) {
          //> Source statement or expression.
          files.push(abs);
          //> Conditional branch.
          if (files.length >= maxFiles) break;
        //> Brace or statement terminator.
        }
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }
  //> Source statement or expression.
  } else {
    //> Throw error.
    throw new ToolFilesystemError("NOT_SEARCHABLE", `${call.tool} target must be a file or directory.`);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const matches = [];
  //> Variable declaration.
  let scannedFiles = 0;
  //> Variable declaration.
  let skippedBinary = 0;
  //> Variable declaration.
  let skippedLarge = 0;
  //> Variable declaration.
  let skippedSensitive = 0;

  //> For-loop header.
  for (const file of files) {
    //> Conditional branch.
    if (matches.length >= maxResults) break;
    //> Variable declaration.
    const rel = path.relative(target.workspaceRoot, file);
    //> Conditional branch.
    if (hasSecretPathPattern(rel)) {
      //> Source statement or expression.
      skippedSensitive += 1;
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const stat = await fsp.stat(file);
    //> Conditional branch.
    if (stat.size > maxBytesPerFile) {
      //> Source statement or expression.
      skippedLarge += 1;
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const buffer = await fsp.readFile(file);
    //> Variable declaration.
    const classByName = classifyFileByName(file);
    //> Variable declaration.
    const classByContent = isLikelyBinaryBuffer(buffer) ? "BINARY" : "TEXT";
    //> Conditional branch.
    if (classByName === "BINARY" || classByContent === "BINARY") {
      //> Source statement or expression.
      skippedBinary += 1;
      //> Source statement or expression.
      continue;
    //> Brace or statement terminator.
    }
    //> Source statement or expression.
    scannedFiles += 1;
    //> Variable declaration.
    const text = buffer.toString("utf8");
    //> Variable declaration.
    const lines = text.split(/\r?\n/);
    //> For-loop header.
    for (let i = 0; i < lines.length; i += 1) {
      //> Variable declaration.
      const line = lines[i];
      //> Variable declaration.
      const haystack = caseSensitive ? line : line.toLowerCase();
      //> Variable declaration.
      const index = haystack.indexOf(needle);
      //> Conditional branch.
      if (index === -1) continue;
      //> Source statement or expression.
      matches.push({
        //> Source statement or expression.
        path: rel,
        //> Source statement or expression.
        line: i + 1,
        //> Source statement or expression.
        column: index + 1,
        //> Source statement or expression.
        snippet: line.slice(0, 240)
      //> Brace or statement terminator.
      });
      //> Conditional branch.
      if (matches.length >= maxResults) break;
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const preview = matches
    //> Source statement or expression.
    .slice(0, 120)
    //> Source statement or expression.
    .map((match) => `${match.path}:${match.line}:${match.column}: ${match.snippet}`)
    //> Source statement or expression.
    .join("\n");
  //> Return a value.
  return {
    //> Source statement or expression.
    answer:
      //> String literal line.
      `filesystem.search query=${JSON.stringify(query)} matches=${matches.length}\n` +
      //> Source statement or expression.
      (preview || "(no matches)") +
      //> String literal line.
      `\n-- scannedFiles=${scannedFiles} skippedBinary=${skippedBinary} skippedLarge=${skippedLarge} skippedSensitive=${skippedSensitive}`,
    //> Source statement or expression.
    audit: {
      //> Source statement or expression.
      operation: call.tool,
      //> Source statement or expression.
      basePath: target.relativePath || ".",
      //> Source statement or expression.
      queryLength: query.length,
      //> Source statement or expression.
      scannedFiles,
      //> Source statement or expression.
      matches: matches.length,
      //> Source statement or expression.
      skippedBinary,
      //> Source statement or expression.
      skippedLarge,
      //> Source statement or expression.
      skippedSensitive
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runFilesystemWrite(call, context) {
  //> Variable declaration.
  const args = asRecord(call.args) || {};
  //> Variable declaration.
  const content = typeof args.content === "string" ? args.content : null;
  //> Conditional branch.
  if (content === null) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "CONTENT_REQUIRED",
      //> String literal line.
      `${call.tool} requires args.content as a string.`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const target = await resolveTargetPath({
    //> Source statement or expression.
    workspaceRoots: context.workspaceRoots,
    //> Source statement or expression.
    requestedPath: asTrimmed(args.path),
    //> Source statement or expression.
    allowCreate: true,
    //> Source statement or expression.
    requireExisting: false,
    //> Source statement or expression.
    operation: call.tool
  //> Brace or statement terminator.
  });
  //> Source statement or expression.
  enforceNonSecretPath(target.relativePath, call.tool);

  //> Variable declaration.
  const maxWriteBytes = clampInt(args.maxBytes, DEFAULT_MAX_WRITE_BYTES, 256, 4 * 1024 * 1024);
  //> Variable declaration.
  const bytes = Buffer.byteLength(content, "utf8");
  //> Conditional branch.
  if (bytes > maxWriteBytes) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "CONTENT_TOO_LARGE",
      //> String literal line.
      `${call.tool} denied: content exceeds maxBytes (${maxWriteBytes}).`,
      //> Source statement or expression.
      { relativePath: target.relativePath, bytes, maxWriteBytes }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const overwrite = asBoolean(args.overwrite, false);
  //> Conditional branch.
  if (target.exists) {
    //> Conditional branch.
    if (!target.lstat || !target.lstat.isFile()) {
      //> Throw error.
      throw new ToolFilesystemError(
        //> String literal line.
        "NOT_A_FILE",
        //> String literal line.
        `${call.tool} denied: existing target is not a regular file.`,
        //> Source statement or expression.
        { relativePath: target.relativePath }
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    }
    //> Conditional branch.
    if (!overwrite) {
      //> Throw error.
      throw new ToolFilesystemError(
        //> String literal line.
        "FILE_EXISTS",
        //> String literal line.
        `${call.tool} denied: file already exists and overwrite=false.`,
        //> Source statement or expression.
        { relativePath: target.relativePath }
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    }
    //> Variable declaration.
    const classByName = classifyFileByName(target.absolutePath);
    //> Conditional branch.
    if (classByName === "BINARY") {
      //> Throw error.
      throw new ToolFilesystemError(
        //> String literal line.
        "BINARY_DENIED",
        //> String literal line.
        `${call.tool} denied: binary file class is not writable via text write.`,
        //> Source statement or expression.
        { relativePath: target.relativePath }
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    }
  //> Source statement or expression.
  } else {
    //> Variable declaration.
    const classByName = classifyFileByName(target.absolutePath);
    //> Conditional branch.
    if (classByName === "BINARY") {
      //> Throw error.
      throw new ToolFilesystemError(
        //> String literal line.
        "BINARY_DENIED",
        //> String literal line.
        `${call.tool} denied: binary extension is blocked for text write.`,
        //> Source statement or expression.
        { relativePath: target.relativePath }
      //> Delimiter or separator.
      );
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Await async value.
  await fsp.mkdir(path.dirname(target.absolutePath), { recursive: true });
  //> Await async value.
  await fsp.writeFile(target.absolutePath, content, "utf8");
  //> Return a value.
  return {
    //> Source statement or expression.
    answer:
      //> String literal line.
      `filesystem.write ${target.relativePath} (${bytes} bytes, sha256=${hashContent(content)})`,
    //> Source statement or expression.
    audit: {
      //> Source statement or expression.
      operation: call.tool,
      //> Source statement or expression.
      relativePath: target.relativePath,
      //> Source statement or expression.
      bytes,
      //> Source statement or expression.
      overwrite,
      //> Source statement or expression.
      created: !target.exists
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runFilesystemEdit(call, context) {
  //> Variable declaration.
  const args = asRecord(call.args) || {};
  //> Variable declaration.
  const search = asTrimmed(args.search);
  //> Conditional branch.
  if (!search) {
    //> Throw error.
    throw new ToolFilesystemError("SEARCH_REQUIRED", `${call.tool} requires args.search.`);
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const replace = typeof args.replace === "string" ? args.replace : null;
  //> Conditional branch.
  if (replace === null) {
    //> Throw error.
    throw new ToolFilesystemError("REPLACE_REQUIRED", `${call.tool} requires args.replace.`);
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const target = await resolveTargetPath({
    //> Source statement or expression.
    workspaceRoots: context.workspaceRoots,
    //> Source statement or expression.
    requestedPath: asTrimmed(args.path),
    //> Source statement or expression.
    allowCreate: false,
    //> Source statement or expression.
    requireExisting: true,
    //> Source statement or expression.
    operation: call.tool
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const loaded = await ensureTextReadableFile(target, args, call.tool);
  //> Variable declaration.
  const replaceAll = asBoolean(args.all, false);
  //> Variable declaration.
  const occurrences = loaded.text.split(search).length - 1;
  //> Conditional branch.
  if (occurrences < 1) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "PATTERN_NOT_FOUND",
      //> String literal line.
      `${call.tool} denied: search pattern not found in file.`,
      //> Source statement or expression.
      { relativePath: target.relativePath }
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const next = replaceAll
    //> Source statement or expression.
    ? loaded.text.split(search).join(replace)
    //> Source statement or expression.
    : loaded.text.replace(search, replace);
  //> Await async value.
  await fsp.writeFile(target.absolutePath, next, "utf8");

  //> Return a value.
  return {
    //> Source statement or expression.
    answer:
      //> String literal line.
      `filesystem.edit ${target.relativePath} replacements=${replaceAll ? occurrences : 1} ` +
      //> String literal line.
      `(sha256=${hashContent(next)})`,
    //> Source statement or expression.
    audit: {
      //> Source statement or expression.
      operation: call.tool,
      //> Source statement or expression.
      relativePath: target.relativePath,
      //> Source statement or expression.
      replaceAll,
      //> Source statement or expression.
      replacements: replaceAll ? occurrences : 1
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runFilesystemMkdir(call, context) {
  //> Variable declaration.
  const args = asRecord(call.args) || {};
  //> Variable declaration.
  const target = await resolveTargetPath({
    //> Source statement or expression.
    workspaceRoots: context.workspaceRoots,
    //> Source statement or expression.
    requestedPath: asTrimmed(args.path),
    //> Source statement or expression.
    allowCreate: true,
    //> Source statement or expression.
    requireExisting: false,
    //> Source statement or expression.
    operation: call.tool
  //> Brace or statement terminator.
  });
  //> Source statement or expression.
  enforceNonSecretPath(target.relativePath, call.tool);
  //> Variable declaration.
  const recursive = asBoolean(args.recursive, true);
  //> Await async value.
  await fsp.mkdir(target.absolutePath, { recursive });
  //> Return a value.
  return {
    //> Source statement or expression.
    answer: `filesystem.mkdir ${target.relativePath} recursive=${recursive}`,
    //> Source statement or expression.
    audit: {
      //> Source statement or expression.
      operation: call.tool,
      //> Source statement or expression.
      relativePath: target.relativePath,
      //> Source statement or expression.
      recursive,
      //> Source statement or expression.
      existed: target.exists
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function runFilesystemStat(call, context) {
  //> Variable declaration.
  const args = asRecord(call.args) || {};
  //> Variable declaration.
  const target = await resolveTargetPath({
    //> Source statement or expression.
    workspaceRoots: context.workspaceRoots,
    //> Source statement or expression.
    requestedPath: asTrimmed(args.path),
    //> Source statement or expression.
    allowCreate: false,
    //> Source statement or expression.
    requireExisting: true,
    //> Source statement or expression.
    operation: call.tool
  //> Brace or statement terminator.
  });
  //> Variable declaration.
  const stat = await fsp.stat(target.absolutePath);
  //> Variable declaration.
  const kind = stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "other";
  //> Return a value.
  return {
    //> Source statement or expression.
    answer:
      //> String literal line.
      `filesystem.stat ${target.relativePath} kind=${kind} bytes=${stat.size} ` +
      //> String literal line.
      `mtime=${stat.mtime.toISOString()}`,
    //> Source statement or expression.
    audit: {
      //> Source statement or expression.
      operation: call.tool,
      //> Source statement or expression.
      relativePath: target.relativePath,
      //> Source statement or expression.
      kind,
      //> Source statement or expression.
      sizeBytes: stat.size
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Async function declaration.
async function executeFilesystemToolCall(call, context) {
  //> Conditional branch.
  if (!call || !call.tool) {
    //> Throw error.
    throw new ToolFilesystemError("CALL_REQUIRED", "Filesystem tool call payload is missing.");
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!context || !Array.isArray(context.workspaceRoots) || !context.workspaceRoots.length) {
    //> Throw error.
    throw new ToolFilesystemError(
      //> String literal line.
      "WORKSPACE_UNAVAILABLE",
      //> String literal line.
      "Filesystem tool context is missing workspace roots."
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Conditional branch.
  if (call.tool === "filesystem.list") return runFilesystemList(call, context);
  //> Conditional branch.
  if (call.tool === "filesystem.read") return runFilesystemRead(call, context);
  //> Conditional branch.
  if (call.tool === "filesystem.search") return runFilesystemSearch(call, context);
  //> Conditional branch.
  if (call.tool === "filesystem.write") return runFilesystemWrite(call, context);
  //> Conditional branch.
  if (call.tool === "filesystem.edit" || call.tool === "filesystem.patch") {
    //> Return a value.
    return runFilesystemEdit(call, context);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (call.tool === "filesystem.mkdir") return runFilesystemMkdir(call, context);
  //> Conditional branch.
  if (call.tool === "filesystem.stat") return runFilesystemStat(call, context);

  //> Throw error.
  throw new ToolFilesystemError(
    //> String literal line.
    "UNSUPPORTED_TOOL",
    //> String literal line.
    `Filesystem runtime does not support ${call.tool} in this phase.`
  //> Delimiter or separator.
  );
//> Brace or statement terminator.
}

//> Async function declaration.
async function resolveFilesystemToolContext(options = {}) {
  //> Variable declaration.
  const workspaceRoots = await resolveWorkspaceRoots(options);
  //> Return a value.
  return {
    //> Source statement or expression.
    workspaceRoots,
    //> Source statement or expression.
    primaryWorkspaceRoot: workspaceRoots[0]
  //> Brace or statement terminator.
  };
//> Brace or statement terminator.
}

//> Source statement or expression.
module.exports = {
  //> Source statement or expression.
  ToolFilesystemError,
  //> Source statement or expression.
  resolveFilesystemToolContext,
  //> Source statement or expression.
  executeFilesystemToolCall
//> Brace or statement terminator.
};
