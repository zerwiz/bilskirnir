import { useCallback, useEffect, useMemo, useState } from 'react';
import { nornirApi, type NornirDoor, type NornirJob, type NornirMachine, type NornirReport } from '../../lib/configApi';
import { useConfigUI } from '../../configStore';
import { Glyph } from './glyphs';
import './ui';
import { RoomsButton } from '../Sidebar';

type Filter = 'all' | 'failing' | 'here';

const REFRESH_MS = 60_000;

/** "in 2 h" / "3 h ago" from an ISO instant; empty when there is none. */
export function relative(iso: string | undefined, now: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return '';
  const s = Math.round(Math.abs(t - now) / 1000);
  const n = s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : s < 129600 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} d`;
  return t >= now ? `in ${n}` : `${n} ago`;
}

const failing = (j: NornirJob) => !j.invalid && j.ok === false;

/** Failing first, then the jobs this machine runs, then the soonest next run. */
export function sortJobs(jobs: NornirJob[]): NornirJob[] {
  const rank = (j: NornirJob) => (failing(j) ? 0 : j.invalid ? 1 : j.here ? 2 : 3);
  const next = (j: NornirJob) => { const t = j.next ? Date.parse(j.next) : NaN; return Number.isNaN(t) ? Infinity : t; };
  return [...jobs].sort((a, b) => rank(a) - rank(b) || next(a) - next(b));
}

function schedule(j: NornirJob): string {
  const days = j.days && j.days.length ? `${j.days.join(', ')} ` : 'Daily ';
  return `${days}${j.at ?? ''}`.trim();
}

function Status({ j }: { j: NornirJob }) {
  if (j.invalid) return <span className="task-chip nornir-chip is-fail">Invalid line</span>;
  if (j.ok === false) return <span className="task-chip nornir-chip is-fail" title={j.why || undefined}>FAIL rc={j.rc ?? '?'}</span>;
  if (j.ok === true) return <span className="task-chip is-working">ok</span>;
  return <span className="task-chip">never ran</span>;
}

function JobRow({ j, now }: { j: NornirJob; now: number }) {
  const bad = failing(j);
  return (
    <tr className={`nornir-job${bad ? ' is-failing' : ''}${!j.here && !j.invalid ? ' is-elsewhere' : ''}`}>
      <td className="nornir-job__when">
        <span>{j.invalid ? '—' : schedule(j)}</span>
        {j.role && <span className="nornir-role">{j.role}</span>}
      </td>
      <td className="nornir-job__cmd"><code>{j.command}</code>{bad && j.why && <div className="nornir-job__why">{j.why}</div>}</td>
      <td className="nornir-job__time">{relative(j.next, now) || '—'}</td>
      <td className="nornir-job__time">{relative(j.last_ran, now) || '—'}</td>
      <td className="nornir-job__status"><Status j={j} /></td>
    </tr>
  );
}

function counts(d: NornirDoor) {
  const real = d.jobs.filter((j) => !j.invalid);
  return { jobs: real.length, here: real.filter((j) => j.here).length, failing: real.filter(failing).length, invalid: d.jobs.length - real.length };
}

function Machine({ m, filter, now }: { m: NornirMachine; filter: Filter; now: number }) {
  const d = m.door;
  const jobs = useMemo(() => sortJobs((d?.jobs ?? []).filter((j) => filter === 'all' || (filter === 'failing' ? failing(j) : !!j.here && !j.invalid))), [d, filter]);
  const c = d ? counts(d) : null;
  return (
    <section className="nornir-machine">
      <div className="section-label nornir-machine__head">
        <span className="nornir-machine__name">{m.name}</span>
        <span className="nornir-machine__meta">{(d?.roles ?? m.roles).join(' · ') || 'no role'}{m.via === 'local' ? ' · this machine' : ''}</span>
        <span className={`task-chip${m.status === 'silent' ? ' nornir-chip is-fail' : d?.clock === 'running' || d?.clock === 'up' ? ' is-working' : ''}`}>
          {m.status === 'silent' ? 'silent' : `clock ${d?.clock ?? 'unknown'}`}
        </span>
      </div>
      <div className="panel-card nornir-card">
        {m.status === 'silent' || !d || !c ? (
          <div className="panel-empty">This machine did not answer: {m.reason || 'no reason given'}.</div>
        ) : (
          <>
            <div className="nornir-counts">
              <span>{c.jobs} jobs</span><span aria-hidden>·</span>
              <span>{c.here} run here</span><span aria-hidden>·</span>
              <span className={c.failing ? 'nornir-bad' : ''}>{c.failing} failing</span>
              {c.invalid > 0 && <><span aria-hidden>·</span><span className="nornir-bad">{c.invalid} invalid</span></>}
            </div>
            {jobs.length === 0 ? <div className="panel-empty">{filter === 'failing' ? 'Nothing is failing.' : 'No job to show.'}</div> : (
              <div className="nornir-scroll">
                <table className="nornir-table">
                  <thead><tr><th>Schedule</th><th>Command</th><th>Next run</th><th>Last run</th><th>Status</th></tr></thead>
                  <tbody>{jobs.map((j, i) => <JobRow key={`${j.command}:${j.at}:${i}`} j={j} now={now} />)}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function useNornir() {
  const [report, setReport] = useState<NornirReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (fresh: boolean) => {
    setBusy(true);
    try { setReport(await nornirApi.get(fresh)); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(false); const t = setInterval(() => load(false), REFRESH_MS); return () => clearInterval(t); }, [load]);
  return { report, error, busy, refresh: () => load(true) };
}

export function NornirView() {
  const { report, error, busy, refresh } = useNornir();
  const [filter, setFilter] = useState<Filter>('all');
  const now = report?.at ?? Date.now();
  const failingTotal = report?.machines.reduce((n, m) => n + (m.door ? counts(m.door).failing : 0), 0) ?? 0;

  return (
    <main className="chat tasks-view">
      <header className="tasks-view__header">
        <RoomsButton />
        <div className="tasks-view__title">Nornir</div>
        <div className="segmented" role="tablist" aria-label="Filter jobs">
          {([['all', 'All'], ['failing', `Failing${failingTotal ? ` ${failingTotal}` : ''}`], ['here', 'Runs here']] as [Filter, string][]).map(([f, label]) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? 'is-active' : ''} onClick={() => setFilter(f)}>{label}</button>
          ))}
        </div>
        <button type="button" className="link-btn link-btn--small" onClick={refresh} disabled={busy}>{busy ? 'Reading…' : 'Refresh'}</button>
      </header>
      <div className="tasks-view__scroll">
        <div className="tasks-view__inner nornir-inner">
          {error && <div className="panel-card"><div className="panel-empty">The clock could not be read: {error}</div></div>}
          {!report && !error ? <div className="cfg-empty">Reading the clock of every machine…</div> : report && (
            <div className="nornir-machines">{report.machines.map((m) => <Machine key={m.name} m={m} filter={filter} now={now} />)}</div>
          )}
        </div>
      </div>
    </main>
  );
}

/** Sidebar entry for the Nornir view. */
export function NornirIsland() {
  const view = useConfigUI((s) => s.view);
  return (
    <button type="button" className={`sidebar-island${view === 'nornir' ? ' is-active' : ''}`} onClick={() => useConfigUI.getState().setView(view === 'nornir' ? 'chat' : 'nornir')} title="Nornir" aria-pressed={view === 'nornir'}>
      <span className="sidebar-island__icon"><Glyph name="clock" size={18} /></span>
      <span className="sidebar-island__label">Nornir</span>
    </button>
  );
}
