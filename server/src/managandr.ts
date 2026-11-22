/**
 * Mánagandr in Bilskirnir — the house's calendar, read through Ymir's one door (2026-11-22).
 *
 * Ymir already reads the operator's calendar: systems/snotra/services/calendar/calendar-ask.sh (Mánagandr), read-only,
 * with its own grant and cache. Bilskirnir never holds a second calendar grant: it asks that door. Without a Ymir
 * runtime the hall says so (state 'absent'); an unreadable calendar is 'unknown', never 'free'.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CalEvent { summary: string; start: string; end: string; all_day: boolean; location: string; conference_url: string; attendee_count: number }
export interface CalAnswer { state: 'ok' | 'unknown' | 'absent'; as_of?: string; stale?: boolean; reason?: string; events: CalEvent[] }

function door(): string | null {
  const roots = [process.env.YMIR_RUNTIME_DIR, join(homedir(), 'ymir-runtime')].filter(Boolean) as string[];
  for (const r of roots) {
    const p = join(r, 'systems', 'snotra', 'services', 'calendar', 'calendar-ask.sh');
    if (existsSync(p)) return p;
  }
  return null;
}

function run(args: string[]): Promise<{ code: number; out: string }> {
  const d = door();
  if (!d) return Promise.resolve({ code: -1, out: '' });
  return new Promise((res) => execFile('bash', [d, ...args], { timeout: 60_000, maxBuffer: 8 << 20 }, (err: any, out) =>
    res({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: String(out || '') })));
}

const WINDOW = /^(\d{1,3}[hdw])$/;

/** What is coming: events from now through the window (default 7 days), soonest first. */
export async function upcoming(window = '7d', limit = 50): Promise<CalAnswer> {
  if (!door()) return { state: 'absent', reason: 'no Ymir runtime with Mánagandr on this machine', events: [] };
  const w = WINDOW.test(window) ? window : '7d';
  const { out } = await run(['json', '--window', w, '--titles']);
  let d: any;
  try { d = JSON.parse(out); } catch { return { state: 'unknown', reason: 'the calendar door did not answer with JSON', events: [] }; }
  if (d.status !== 'ok') return { state: 'unknown', reason: d.reason || d.status, as_of: d.as_of, events: [] };
  const nowMs = Date.now();
  const events: CalEvent[] = (d.events || [])
    .filter((e: any) => e.status !== 'cancelled' && (e.end_ms ?? Date.parse(e.end)) >= nowMs)
    .sort((a: any, b: any) => (a.start_ms ?? 0) - (b.start_ms ?? 0))
    .slice(0, limit)
    .map((e: any) => ({ summary: e.summary || '(busy)', start: e.start, end: e.end, all_day: !!e.all_day, location: e.location || '',
      conference_url: e.conference_url || '', attendee_count: e.attendee_count || 0 }));
  return { state: 'ok', as_of: d.as_of, stale: !!d.stale, events };
}

/** Is the operator free for the next window (e.g. 2h)? 'free' | 'busy' | 'unknown' — unknown is never free. */
export async function freeFor(window = '1h'): Promise<{ state: 'free' | 'busy' | 'unknown' | 'absent'; window: string }> {
  if (!door()) return { state: 'absent', window };
  const w = WINDOW.test(window) ? window : '1h';
  const { code } = await run(['busy', '--window', w]);
  return { state: code === 0 ? 'free' : code === 10 ? 'busy' : 'unknown', window: w };
}
