// The client's address as App Service forwards it: X-Client-IP, else the first X-Forwarded-For entry without
// its port (the same order as better-auth's ipAddressHeaders in auth.ts).
export const clientIp = (headers: Headers): string | undefined => {
  const direct = headers.get('x-client-ip')?.trim();
  if (direct) return direct;
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!first) return undefined;
  // IPv4 with a port ("1.2.3.4:5678"); IPv6 may come bracketed with a port ("[::1]:5678")
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(first);
  if (bracketed) return bracketed[1];
  return /^[\d.]+:\d+$/.test(first) ? first.slice(0, first.lastIndexOf(':')) : first;
};
