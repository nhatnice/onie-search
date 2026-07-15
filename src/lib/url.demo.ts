import { canonicalizeUrl } from './url';

function expect(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.warn(`${ok ? 'ok' : 'FAIL'}  ${label}  →  ${JSON.stringify(actual)}`);
  if (!ok) {
    console.error(`        expected: ${JSON.stringify(expected)}`);
    process.exitCode = 1;
  }
}

expect(
  canonicalizeUrl('  https://Example.COM:443/foo/../bar  '),
  'https://example.com/bar',
  'rfc3986: scheme+host lowercase, default port removed, dot-segments removed, trim',
);
expect(
  canonicalizeUrl('https://example.com/path?b=2&utm_source=x&a=1'),
  'https://example.com/path?a=1&b=2',
  'sort query, remove tracking',
);
expect(canonicalizeUrl('https://www.example.com/'), 'https://example.com/', 'strip www');
expect(
  canonicalizeUrl('https://example.com/?#'),
  'https://example.com/',
  'strip empty query + fragment',
);
expect(
  canonicalizeUrl('/foo/bar', { baseUrl: 'https://example.com/baz/' }),
  'https://example.com/foo/bar',
  'relative → absolute',
);
expect(canonicalizeUrl('javascript:alert(1)'), undefined, 'reject javascript:');
expect(canonicalizeUrl('mailto:[email protected]'), undefined, 'reject mailto:');
expect(
  canonicalizeUrl('https://example.com/foo%2a'),
  'https://example.com/foo*',
  'percent-encoding: normalize-url decodes %2A to * (lib behavior)',
);
expect(
  canonicalizeUrl('https://example.com/%7Efoo'),
  'https://example.com/~foo',
  'decode unreserved',
);
expect(
  canonicalizeUrl('https://example.com/?a=1&a=2&b=3'),
  'https://example.com/?a=1&a=2&b=3',
  'sort query (normalize-url does not dedup same-name params)',
);
