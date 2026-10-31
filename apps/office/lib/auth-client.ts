// The browser's side of better-auth: sign-in and sign-out go through /api/auth, where its rate limit applies.
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();
