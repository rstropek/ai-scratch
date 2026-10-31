// Runs once when a server starts, before it takes requests.
export const register = async (): Promise<void> => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { migrateOnStart } = await import('./lib/migrate-on-start.ts');
  await migrateOnStart();
};
