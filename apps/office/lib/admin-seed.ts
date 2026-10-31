import { type Auth, MIN_PASSWORD_LENGTH } from './auth.ts';

export const ADMIN_EMAIL = 'rainer@software-architects.at';

export interface AdminAccount {
  email: string;
  name: string;
  password: string;
}

/**
 * Creates the account with the `admin` role, or gives an existing one the role and the new password and ends its
 * sessions. Runs without a signed-in admin: only scripts call it, never a request.
 */
export const ensureAdmin = async (
  auth: Auth,
  { email, name, password }: AdminAccount,
): Promise<'created' | 'updated'> => {
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new Error(`The password needs at least ${MIN_PASSWORD_LENGTH} characters`);
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(email.toLowerCase());
  if (!existing) {
    await auth.api.createUser({ body: { email, password, name, role: 'admin' } });
    return 'created';
  }
  const userId = existing.user.id;
  await ctx.internalAdapter.updateUser(userId, { name, role: 'admin', banned: false });
  const hash = await ctx.password.hash(password);
  if (await ctx.internalAdapter.findCredentialAccount(userId)) await ctx.internalAdapter.updatePassword(userId, hash);
  else await ctx.internalAdapter.linkAccount({ providerId: 'credential', accountId: userId, password: hash, userId });
  await ctx.internalAdapter.deleteUserSessions(userId);
  return 'updated';
};
