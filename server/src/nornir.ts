import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Nornir: the house's clock, read from every machine of the fleet.
 *
 * The data door is Ymir's `bin/time/nornir-jobs.py --json`. It is run here on this machine, and over ssh on every
 * other machine of the operator's fleet registry (`$YMIR_HOME/hodd/data/fleet.json`, hosts.<name>.{user,tailnet,roles}).
 * Nothing about a host is written in this code: names, users and addresses are read from the registry at run time.
 */

export interface NornirJob {
  role?: string;
  days?: string[];
  at?: string;
  command: string;
  here?: boolean;
  next?: string;
  last_ran?: string;
  ok?: boolean | null;
  rc?: number | null;
  why?: string;
  invalid?: boolean;
}

export interface NornirDoor {
  machine: string;
  roles: string[];
  clock: string;
  now: string;
  jobs: NornirJob[];
  counts?: Record<string, number>;
}

export interface NornirMachine {
  name: string;
  /** `local` is the machine this server runs on; `ssh` is one reached over the tailnet. */
  via: 'local' | 'ssh';
  status: 'ok' | 'silent';
  reason?: string;
  /** What the registry says this machine's roles are (the door's own answer wins when it answers). */
  roles: string[];
  door?: NornirDoor;
}

export interface NornirReport { machines: NornirMachine[]; at: number }

const TTL_MS = 60_000;
const SSH_TIMEOUT_MS = 20_000;
const SAFE = /^[A-Za-z0-9._-]+$/;
const NOT_HOSTS = new Set(['localhost', 'unknown']);

const home = () => process.env.YMIR_HOME || path.join(os.homedir(), 'Documents', 'ymirhome');
const runtimeDir = () => process.env.YMIR_RUNTIME_DIR || path.join(os.homedir(), 'ymir-runtime');

/** The local copy of the data door, or null while no release carries it. */
export function localDoor(): string | null {
  const candidates = [process.env.NORNIR_JOBS_DOOR, path.join(runtimeDir(), 'bin', 'time', 'nornir-jobs.py')];
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  return null;
}

interface RegistryHost { name: string; user?: string; tailnet?: string; roles: string[] }

function readRegistry(): RegistryHost[] {
  const file = path.join(home(), 'hodd', 'data', 'fleet.json');
  let raw: any;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
  const hosts = raw?.hosts && typeof raw.hosts === 'object' ? raw.hosts : {};
  return Object.entries(hosts)
    .filter(([name]) => !NOT_HOSTS.has(name))
    .map(([name, h]: [string, any]) => ({
      name,
      user: typeof h?.user === 'string' ? h.user : undefined,
      tailnet: typeof h?.tailnet === 'string' ? h.tailnet : undefined,
      roles: Array.isArray(h?.roles) ? h.roles.map(String) : [],
    }));
}

function run(cmd: string, args: string[], timeout: number, stdin?: string): Promise<{ out: string; err: string; code: number | null; killed: boolean }> {
  return new Promise((resolve) => {
    const child = execFile(cmd, args, { timeout, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ out: String(stdout), err: String(stderr), code: error ? ((error as any).code ?? 1) : 0, killed: !!(error && (error as any).killed) });
    });
    if (stdin !== undefined) child.stdin?.end(stdin); else child.stdin?.end();
  });
}

function parseDoor(out: string): NornirDoor {
  const j = JSON.parse(out);
  if (!j || !Array.isArray(j.jobs)) throw new Error('the door answered with no jobs list');
  return j as NornirDoor;
}

const firstLine = (s: string) => s.trim().split('\n').filter(Boolean).pop()?.slice(0, 240) ?? '';

async function readLocal(name: string, roles: string[]): Promise<NornirMachine> {
  const door = localDoor();
  if (!door) return { name, via: 'local', status: 'silent', roles, reason: 'the clock door (nornir-jobs.py) is not in this machine\'s runtime yet' };
  const r = await run('python3', [door, '--json'], 30_000);
  if (r.code !== 0) return { name, via: 'local', status: 'silent', roles, reason: firstLine(r.err) || `the door exited ${r.code}` };
  try { const d = parseDoor(r.out); return { name: d.machine || name, via: 'local', status: 'ok', roles: d.roles ?? roles, door: d }; }
  catch (e: any) { return { name, via: 'local', status: 'silent', roles, reason: `unreadable answer: ${e?.message ?? e}` }; }
}

// The remote shell runs the machine's own copy when it has one, else the copy piped on stdin.
const REMOTE = 'f="$HOME/ymir-runtime/bin/time/nornir-jobs.py"; if [ -f "$f" ]; then python3 "$f" --json; else YMIR_ROOT="$HOME/ymir-runtime" python3 - --json; fi';

async function readRemote(h: RegistryHost): Promise<NornirMachine> {
  const base = { name: h.name, via: 'ssh' as const, roles: h.roles };
  if (!h.user || !h.tailnet) return { ...base, status: 'silent', reason: 'the fleet registry gives this machine no user or address to reach it by' };
  if (!SAFE.test(h.user) || !SAFE.test(h.tailnet)) return { ...base, status: 'silent', reason: 'the registry user or address is not a plain name' };
  const door = localDoor();
  let source = '';
  if (door) { try { source = fs.readFileSync(door, 'utf8'); } catch { /* the remote copy may still answer */ } }
  const r = await run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', `${h.user}@${h.tailnet}`, REMOTE], SSH_TIMEOUT_MS, source);
  if (r.killed) return { ...base, status: 'silent', reason: `no answer within ${SSH_TIMEOUT_MS / 1000} s` };
  if (r.code !== 0) return { ...base, status: 'silent', reason: firstLine(r.err) || `ssh exited ${r.code}` };
  try { const d = parseDoor(r.out); return { ...base, status: 'ok', roles: d.roles ?? h.roles, door: d }; }
  catch (e: any) { return { ...base, status: 'silent', reason: firstLine(r.err) || `unreadable answer: ${e?.message ?? e}` }; }
}

let cache: { at: number; report: NornirReport } | null = null;
let inflight: Promise<NornirReport> | null = null;

async function gather(): Promise<NornirReport> {
  const registry = readRegistry();
  const me = os.hostname().split('.')[0].toLowerCase();
  const mine = registry.find((h) => h.name.toLowerCase() === me);
  const others = registry.filter((h) => h !== mine);
  const machines = await Promise.all([readLocal(mine?.name ?? me, mine?.roles ?? []), ...others.map(readRemote)]);
  return { machines, at: Date.now() };
}

export async function nornirReport(force = false): Promise<NornirReport> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.report;
  inflight ??= gather().then((report) => { cache = { at: Date.now(), report }; return report; }).finally(() => { inflight = null; });
  return inflight;
}
