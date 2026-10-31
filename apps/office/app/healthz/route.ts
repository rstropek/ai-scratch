// The deployed commit, for the deploy and swap workflows; no login, no database.
export const dynamic = 'force-dynamic';

export const GET = () => Response.json({ version: process.env.APP_VERSION ?? 'dev' });
