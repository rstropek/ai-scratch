/** better-auth's admin plugin keeps roles comma-separated in one column */
export const isAdmin = (user: { role?: string | null }): boolean =>
  (user.role ?? '').split(',').some((role) => role.trim() === 'admin');
