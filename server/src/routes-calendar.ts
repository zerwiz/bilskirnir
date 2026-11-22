import { Hono } from 'hono';
import { requireUser, type AuthVars } from './lib/auth.js';
import { freeFor, upcoming } from './managandr.js';

/** /api/calendar — Mánagandr, the house's read calendar (GET ?window=7d), and /api/calendar/free?window=2h. */
export const calendarApi = new Hono<AuthVars>();
calendarApi.use('*', requireUser);
calendarApi.get('/', async (c) => c.json(await upcoming(c.req.query('window') || '7d')));
calendarApi.get('/free', async (c) => c.json(await freeFor(c.req.query('window') || '1h')));
