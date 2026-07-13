import { JSDOM, VirtualConsole } from 'jsdom';

// ponytail: swallow JSDOM internal browser console output (CSS/HTML parse noise).
export function createSilentJSDOM(
  html: string,
  opts: { url?: string; contentType?: string } = {},
): JSDOM {
  return new JSDOM(html, { ...opts, virtualConsole: new VirtualConsole() });
}
