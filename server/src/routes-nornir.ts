import { Hono } from 'hono';
import { requireUser, type AuthVars } from './lib/auth.js';
import { nornirReport } from './nornir.js';

/** /api/nornir: every scheduled job of the house's clock, on every machine of the fleet (cached 60 s). */
export const nornirApi = new Hono<AuthVars>();
nornirApi.use('*', requireUser);

nornirApi.get('/', async (c) => {
  try { return c.json(await nornirReport(c.req.query('fresh') === '1')); }
  catch (e: any) { return c.json({ error: e?.message ?? String(e) }, 500); }
});
