import { getAuth } from '../../../../lib/session.ts';

// better-auth's endpoints (sign-in, sign-out, session, admin); the handler is created on the first request
const handle = (request: Request) => getAuth().handler(request);

export { handle as GET, handle as POST };
