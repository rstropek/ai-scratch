import { describe, expect, it } from 'vitest';
import { clientIp } from './client-ip.ts';

describe('clientIp', () => {
  it('prefers X-Client-IP', () => {
    expect(clientIp(new Headers({ 'x-client-ip': '1.2.3.4', 'x-forwarded-for': '5.6.7.8:9' }))).toBe('1.2.3.4');
  });

  it('takes the first X-Forwarded-For entry without its port', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '5.6.7.8:443, 10.0.0.1' }))).toBe('5.6.7.8');
    expect(clientIp(new Headers({ 'x-forwarded-for': '[2001:db8::1]:443' }))).toBe('2001:db8::1');
    expect(clientIp(new Headers({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('is undefined without either header', () => {
    expect(clientIp(new Headers())).toBeUndefined();
  });
});
