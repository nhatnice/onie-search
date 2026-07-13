export const stripNullBytes = (s: string | undefined): string | undefined => {
  if (s == null) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) !== 0) out += s[i];
  }
  return out;
};
