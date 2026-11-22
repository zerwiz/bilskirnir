# 2026-11-22 — Mánagandr works in Bilskirnir

The Allfather: *"I also want Mánagandr to be functional in Bilskirnir's calendar."*

Ymir already reads his calendar through one read-only door, Mánagandr (`systems/snotra/services/calendar/calendar-ask.sh`, its own grant and cache). Bilskirnir now asks that door instead of needing a second calendar grant:

- **`server/src/managandr.ts`** finds the door in the Ymir runtime (`YMIR_RUNTIME_DIR`, else `~/ymir-runtime`) and answers *upcoming* (events from now, soonest first) and *free for a window* (free · busy · unknown; unknown is never free). No runtime: `absent`, said plainly.
- **`/api/calendar`** (`?window=7d`) and **`/api/calendar/free`** (`?window=2h`), signed-in users only.
- **Two agent tools**, `calendar_upcoming` and `calendar_free`, so Nanna and every Bot answer *"what is on tomorrow?"* or *"am I free for two hours?"* from his real calendar, before any connected calendar app.
- **The calendar card** in the details panel: the next six things in seven days, with *Join* for a meeting link; refreshed every five minutes.

Measured on the desk: `upcoming` returned his next events (status ok); `freeFor(2h)` answered free; typecheck and build pass.
