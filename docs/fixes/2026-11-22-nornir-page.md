# 2026-11-22 — a Nornir page: every scheduled job of the house's clock, on every machine

The Allfather asked for one place to see the house's clock on the whole fleet. Bilskirnir now has a **Nornir** page, opened from the sidebar entry of the same name.

## What it shows

One section per machine: the state of its clock, its roles, and counts (jobs, run here, failing, invalid). Under that, a table of its jobs: schedule (days, time, role), the command, next run ("in 2 h"), last run, and status (`ok`, `FAIL rc=N` with the reason, or `never ran`). Failing jobs come first and are red. Jobs the machine does not run are dimmed. The filter is *All · Failing · Runs here*. The page refreshes every 60 s and has a Refresh button.

A machine that does not answer is shown as `silent` with the reason (ssh timeout, no address in the registry). It is never dropped.

## How it works

- `server/src/nornir.ts` runs Ymir's data door, `bin/time/nornir-jobs.py --json`, on this machine (`$YMIR_RUNTIME_DIR/bin/time/nornir-jobs.py`, else `~/ymir-runtime/…`; `NORNIR_JOBS_DOOR` overrides the path). For every other machine in `$YMIR_HOME/hodd/data/fleet.json` (`hosts.<name>.{user,tailnet,roles}`) it runs the door over `ssh -o BatchMode=yes -o ConnectTimeout=5`, with a 20 s timeout. When the remote machine has no copy, the local door is piped on stdin with `YMIR_ROOT=~/ymir-runtime`. The answer is cached for 60 s.
- No host, user or address is written in the code (RULES/04). All of them come from the registry. A registry user or address that is not a plain name is refused before ssh is called.
- `GET /api/nornir` (signed-in only; `?fresh=1` skips the cache) is registered in `server/src/index.ts`.
- The page is `web/src/components/config/NornirView.tsx`, with its styles at the end of `web/src/styles/config.css`.

## Proof

`npm run typecheck` and `npm run build` pass. The compiled module was run against the real fleet: heimdall (local, 49 jobs, 23 here, 1 failing), the heart (clock running, 25 here, 2 failing: the daily briefing and the nsr-compliance check), the second dev machine (4 failing), and three machines shown as `silent` with their reasons (two ssh timeouts, two without an address in the registry).

Not proven yet: the page in the real window through DevTools. It needs a release that carries `nornir-jobs.py` into `~/ymir-runtime`; until then the local machine reads the door from `NORNIR_JOBS_DOOR`.
