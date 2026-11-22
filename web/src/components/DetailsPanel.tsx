import { useEffect, useState } from 'react';
import type { Routine } from '@shared/types';
import { BotAvatarFor } from '../avatar/BotAvatar';
import { api, openPopup } from '../lib/api';
import { botVars } from '../lib/colors';
import { computerStatusText } from '../lib/computer';
import { displayName, useSelectedBot, useStore } from '../store';
import { Icon } from './Icon';
import { ToolkitLogo } from './ToolkitLogo';
import { VoiceSettings } from './VoiceSettings';
import { ComputerScreen, type ScreenMode } from './ComputerViewer';
import { EngineSettings } from './EngineSettings';
import { MembersCard } from './MembersCard';
import { useConfigUI } from '../configStore';
import { Glyph } from './config/glyphs';
import { LibraryTab } from './config/LibraryTab';
import { BotTasks } from './config/TasksView';

// Other files import this from here; it lives in lib/computer so the viewer can use it too.
export { computerStatusText };

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span className="toggle__knob" />
    </button>
  );
}

function RoutineRow({ r }: { r: Routine }) {
  const [enabled, setEnabled] = useState(r.enabled);
  useEffect(() => setEnabled(r.enabled), [r.enabled]);
  const toggle = async (v: boolean) => {
    setEnabled(v);
    try { await api.setRoutine(r.id, v); } catch { setEnabled(!v); }
  };
  return (
    <div className="panel-row panel-row--routine" title={r.prompt}>
      <span className="panel-row__icon"><Icon name="clock" opacity={0.52} /></span>
      <span className="panel-row__text">
        <span className="panel-row__title">{r.name}</span>
        <span className="panel-row__sub">{enabled ? r.description || r.schedule : 'Paused'}</span>
      </span>
      <Toggle on={enabled} onChange={toggle} label={`${r.name} ${enabled ? 'on' : 'off'}`} />
    </div>
  );
}

export function DetailsPanel() {
  const bot = useSelectedBot();
  const routines = useStore((s) => (bot ? s.routines[bot.id] : undefined));
  const computer = useStore((s) => s.computer);
  const viewerOpen = useStore((s) => s.viewerOpen);
  const set = useStore((s) => s.set);
  const [tab, setTab] = useState<'activity' | 'tasks' | 'library'>('activity');
  const [hideSuggested, setHideSuggested] = useState(() => { try { return localStorage.getItem('grokbot.hideSuggested') === '1'; } catch { return false; } });
  if (!bot) return null;

  const openComputer = (mode: ScreenMode) => set({ viewerOpen: true, viewerMode: mode, viewerHint: null });
  const addSlack = async () => {
    const popup = openPopup('about:blank');
    try { const { redirectUrl } = await api.connect('slack'); if (popup) popup.location.href = redirectUrl; } catch { popup?.close(); }
  };

  return (
    <aside className="details" style={botVars(bot.avatarColor)} aria-label="Conversation details">
      <div className="details__top">
        <button type="button" className="icon-btn icon-btn--bordered details__gear" onClick={() => useConfigUI.getState().openBotSettings(bot.id)} aria-label="Agent settings" title="Agent settings">
          <Glyph name="gear" size={16} opacity={0.7} />
        </button>
        <button type="button" className="icon-btn icon-btn--bordered" onClick={() => set({ detailsOpen: false })} aria-label="Close details">
          <Icon name="close" opacity={0.92} />
        </button>
      </div>
      <div className="details__scroll">
        {bot.kind === 'room' ? (
          <div className="details__identity">
            <BotAvatarFor bot={bot} size={64} />
            <div className="details__name" title={displayName(bot)}>{displayName(bot)}</div>
          </div>
        ) : (
          <div className="details__hero">
            <ComputerScreen key={bot.id} bot={bot} variant="panel" paused={viewerOpen} onExpand={openComputer} />
            <div className="details__who">
              <BotAvatarFor bot={bot} size={36} />
              <div className="details__who-text">
                <div className="details__who-head">
                  <span className="details__who-name" title={displayName(bot)}>{displayName(bot)}</span>
                  {bot.model && <span className="details__model" title={bot.provider ? `${bot.provider} · ${bot.model}` : bot.model}>{bot.model}</span>}
                </div>
                <div className="details__who-sub">Computer {computerStatusText(computer).toLowerCase()}</div>
              </div>
              <button type="button" className="btn btn--sm btn--secondary details__open" onClick={() => openComputer('watch')}>Open</button>
            </div>
          </div>
        )}
        <div className="details__tabs">
          <div className="segmented">
            <button type="button" className={tab === 'activity' ? 'is-active' : ''} onClick={() => setTab('activity')}>Activity</button>
            <button type="button" className={tab === 'tasks' ? 'is-active' : ''} onClick={() => setTab('tasks')}>Errands</button>
            <button type="button" className={tab === 'library' ? 'is-active' : ''} onClick={() => setTab('library')}>The shelf</button>
          </div>
        </div>
        {tab === 'activity' ? (
          <div className="details__sections">
            <section>
              <div className="section-label section-label--row">
                <span>Coming up</span>
                <button type="button" className="link-btn link-btn--small" onClick={() => useConfigUI.getState().openBotSettings(bot.id, 'routines')}>Manage</button>
              </div>
              <div className="panel-card">
                {routines?.length ? routines.map((r) => <RoutineRow key={r.id} r={r} />) : (
                  <div className="panel-empty">Nothing set. Ask in the room, for example “send me a summary every weekday at 8am”.</div>
                )}
              </div>
            </section>
            <CalendarSection />
            {bot.kind === 'room' && (
              <section>
                <div className="section-label">Members</div>
                <MembersCard room={bot} />
              </section>
            )}
            {bot.kind !== 'room' && !hideSuggested && (
              <section>
                <div className="section-label section-label--row">
                  <span>Suggested</span>
                  <button type="button" className="link-btn link-btn--small" onClick={() => { setHideSuggested(true); try { localStorage.setItem('grokbot.hideSuggested', '1'); } catch { /* ignore */ } }}>Hide</button>
                </div>
                <div className="panel-card">
                  <button type="button" className="panel-row panel-row--link" onClick={addSlack}>
                    <span className="panel-row__glyph"><ToolkitLogo name="Slack" logo="/assets/icons/slack.svg" size={16} radius={4} /></span>
                    <span className="panel-row__title" style={{ flex: 1 }}>Add to Slack</span>
                    <Icon name="chev_right" size={12} opacity={0.56} />
                  </button>
                </div>
              </section>
            )}
            {bot.kind !== 'room' && (
              <>
                <section>
                  <div className="section-label">The engine</div>
                  <EngineSettings bot={bot} />
                </section>
                <section>
                  <div className="section-label">The voice</div>
                  <VoiceSettings bot={bot} />
                </section>
              </>
            )}
          </div>
        ) : tab === 'tasks' ? <BotTasks bot={bot} /> : <LibraryTab bot={bot} />}
      </div>
    </aside>
  );
}

/** Mánagandr — the house's calendar, read through Ymir's door (/api/calendar): the next few things on the day. */
function CalendarSection() {
  const [cal, setCal] = useState<{ state: string; reason?: string; events: { summary: string; start: string; end: string; all_day: boolean; conference_url: string }[] } | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => fetch('/api/calendar?window=7d', { credentials: 'include' }).then((r) => r.json()).then((d) => { if (live) setCal(d); }).catch(() => { if (live) setCal({ state: 'unknown', events: [] }); });
    load(); const t = setInterval(load, 5 * 60_000);
    return () => { live = false; clearInterval(t); };
  }, []);
  if (!cal || cal.state === 'absent') return null;
  const when = (iso: string, allDay: boolean) => {
    const d = new Date(iso); const today = new Date(); const tomorrow = new Date(Date.now() + 864e5);
    const day = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === tomorrow.toDateString() ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return allDay ? day : `${day} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  };
  return (
    <section>
      <div className="section-label section-label--row"><span>The calendar</span><span className="panel-row__meta">Mánagandr</span></div>
      <div className="panel-card">
        {cal.state !== 'ok' ? <div className="panel-empty">The calendar cannot be read right now{cal.reason ? ` (${cal.reason})` : ''}.</div>
          : cal.events.length === 0 ? <div className="panel-empty">Nothing in the next seven days.</div>
          : cal.events.slice(0, 6).map((e, i) => (
            <div key={i} className="panel-row">
              <span className="panel-row__title" style={{ flex: 1 }}>{e.summary}</span>
              <span className="panel-row__meta">{when(e.start, e.all_day)}</span>
              {e.conference_url && <a className="link-btn link-btn--small" href={e.conference_url} target="_blank" rel="noopener noreferrer">Join</a>}
            </div>
          ))}
      </div>
    </section>
  );
}
