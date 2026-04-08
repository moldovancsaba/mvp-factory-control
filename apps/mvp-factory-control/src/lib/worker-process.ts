/**
 * **Process-level** worker introspection on the host: discover running worker PIDs from `ps`, spawn helpers.
 *
 * Uses `ps -eo pid=,args=` for macOS/Linux portability (not BSD `command` column). `spawnDetachedWorker`
 * starts the Node worker script with stdio to log files under `.mvp-factory-control`. Used by agents UI/API.
 */
//> Import bindings from a module.
import fs from "node:fs";
//> Import bindings from a module.
import path from "node:path";
//> Import bindings from a module.
import { execSync, spawn } from "node:child_process";
//> Import bindings from a module.
import { prisma } from "@/lib/prisma";

//> Export declaration.
export type RunningWorker = {
  //> Source statement or expression.
  pid: number;
  //> Source statement or expression.
  agentKey: string | null;
  //> Source statement or expression.
  command: string;
//> Brace or statement terminator.
};

//> Function declaration.
function appRoot() {
  //> Return a value.
  return process.cwd();
//> Brace or statement terminator.
}

//> Export declaration.
export function isRuntimeRunnable(runtime: string | null | undefined) {
  //> Return a value.
  return runtime === "LOCAL" || runtime === "CLOUD";
//> Brace or statement terminator.
}

//> Export declaration.
export function listRunningWorkers(): RunningWorker[] {
  //> Variable declaration.
  let out = "";
  //> Try block start.
  try {
    // Portable across macOS + Linux/Alpine (BusyBox): avoid BSD-only "command" column.
    //> Source statement or expression.
    out = execSync("ps -eo pid=,args=", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  //> Source statement or expression.
  } catch {
    //> Return a value.
    return [];
  //> Brace or statement terminator.
  }
  //> Variable declaration.
  const rows = out.split("\n");
  //> Variable declaration.
  const workers: RunningWorker[] = [];
  //> For-loop header.
  for (const row of rows) {
    //> Variable declaration.
    const trimmed = row.trim();
    //> Conditional branch.
    if (!trimmed) continue;
    //> Variable declaration.
    const m = /^(\d+)\s+(.+)$/.exec(trimmed);
    //> Conditional branch.
    if (!m) continue;
    //> Variable declaration.
    const pid = Number(m[1]);
    //> Variable declaration.
    const command = m[2];
    //> Conditional branch.
    if (!/node .*scripts\/worker\.js/.test(command)) continue;
    //> Variable declaration.
    const am = /--agent=([A-Za-z0-9_-]+)/.exec(command);
    //> Source statement or expression.
    workers.push({ pid, agentKey: am?.[1] ?? null, command });
  //> Brace or statement terminator.
  }
  //> Return a value.
  return workers;
//> Brace or statement terminator.
}

//> Export declaration.
export async function startWorker(agentKey: string) {
  //> Variable declaration.
  const agent = await prisma.agent.findUnique({
    //> Source statement or expression.
    where: { key: agentKey },
    //> Source statement or expression.
    select: { key: true, enabled: true, runtime: true, controlRole: true }
  //> Brace or statement terminator.
  });
  //> Conditional branch.
  if (!agent) {
    //> Throw error.
    throw new Error(`Agent ${agentKey} is not registered.`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!agent.enabled) {
    //> Throw error.
    throw new Error(`Agent ${agentKey} is disabled.`);
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (!isRuntimeRunnable(agent.runtime)) {
    //> Throw error.
    throw new Error(
      //> String literal line.
      `Agent ${agentKey} runtime is ${agent.runtime}; only LOCAL/CLOUD runtimes can run workers.`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }
  //> Conditional branch.
  if (agent.controlRole !== "ALPHA") {
    //> Throw error.
    throw new Error(
      //> String literal line.
      `Agent ${agentKey} role is ${agent.controlRole}. Only ALPHA agents can run control-plane workers.`
    //> Delimiter or separator.
    );
  //> Brace or statement terminator.
  }

  //> Variable declaration.
  const existing = listRunningWorkers().find((w) => w.agentKey === agentKey);
  //> Conditional branch.
  if (existing) return { started: false, pid: existing.pid };

  //> Variable declaration.
  const logsDir = path.join(appRoot(), ".mvp-factory-control", "worker-logs");
  //> Source statement or expression.
  fs.mkdirSync(logsDir, { recursive: true });
  //> Variable declaration.
  const logPath = path.join(logsDir, `${agentKey}.log`);
  //> Variable declaration.
  const out = fs.openSync(logPath, "a");

  //> Variable declaration.
  const child = spawn(
    //> Source statement or expression.
    process.execPath,
    //> Source statement or expression.
    ["scripts/worker.js", `--agent=${agentKey}`],
    //> Brace or statement terminator.
    {
      //> Source statement or expression.
      cwd: appRoot(),
      //> Source statement or expression.
      detached: true,
      //> Source statement or expression.
      stdio: ["ignore", out, out],
      //> Source statement or expression.
      env: {
        //> Source statement or expression.
        ...process.env,
        //> Source statement or expression.
        MVP_FACTORY_CONTROL_WORKER_AGENT_KEY: agentKey
      //> Brace or statement terminator.
      }
    //> Brace or statement terminator.
    }
  //> Delimiter or separator.
  );
  //> Source statement or expression.
  child.unref();
  //> Return a value.
  return { started: true, pid: child.pid };
//> Brace or statement terminator.
}

//> Export declaration.
export async function stopWorker(agentKey: string) {
  //> Variable declaration.
  const matching = listRunningWorkers().filter((w) => w.agentKey === agentKey);
  //> Conditional branch.
  if (!matching.length) return { stopped: false, count: 0 };

  //> For-loop header.
  for (const p of matching) {
    //> Try block start.
    try {
      //> Source statement or expression.
      process.kill(p.pid, "SIGTERM");
    //> Source statement or expression.
    } catch {
      // Process may already have exited.
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  // Give workers a short grace period.
  //> Await async value.
  await new Promise((r) => setTimeout(r, 500));

  //> Variable declaration.
  const remaining = listRunningWorkers().filter((w) => w.agentKey === agentKey);
  //> For-loop header.
  for (const p of remaining) {
    //> Try block start.
    try {
      //> Source statement or expression.
      process.kill(p.pid, "SIGKILL");
    //> Source statement or expression.
    } catch {
      // Process may already have exited.
    //> Brace or statement terminator.
    }
  //> Brace or statement terminator.
  }

  //> Return a value.
  return { stopped: true, count: matching.length };
//> Brace or statement terminator.
}
