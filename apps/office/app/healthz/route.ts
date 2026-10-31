// The deployed commit, for the deploy workflow; no login, no database.
export const dynamic = 'force-dynamic';

export const GET = () => Response.json({ version: process.env.APP_VERSION ?? 'dev' });
