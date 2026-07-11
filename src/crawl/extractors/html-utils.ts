/** Resolve a possibly-relative href against a base URL. Returns undefined on invalid input. */
export function safeUrl(href: string, base: string): string | undefined {
  try {
    return new URL(href, base).href;
  } catch {
    return undefined;
  }
}

/** Get trimmed text content of the first element matching a CSS selector. */
export function textOf(document: Document, selector: string): string | undefined {
  const text = document.querySelector(selector)?.textContent?.trim();
  return text || undefined;
}

/** Get trimmed attribute value of the first element matching a CSS selector. */
export function attrOf(document: Document, selector: string, attr: string): string | undefined {
  const value = document.querySelector(selector)?.getAttribute(attr)?.trim();
  return value || undefined;
}
