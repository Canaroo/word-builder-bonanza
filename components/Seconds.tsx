import React from 'react';

/**
 * Seconds in the arcade fonts. Bungee (titles, buttons) has no lowercase, so "+25s" renders as
 * "+25S", and its S reads as a 5 ("+255"); VT323 (the VCR text) is nearly as bad. Seconds are never
 * written as a bare "s" in those fonts: use <Sec /> after a number, or withSec() on a string. Both
 * give the number plus a small, lowercase "sec" in the plain font.
 */
export const Sec: React.FC = () => (
  <span className="font-sans text-[0.55em] font-semibold lowercase tracking-wide align-baseline ml-0.5" style={{ textShadow: 'none', letterSpacing: '0.02em' }}>sec</span>
);

/** A decade ("'90s", "80s", "2000s"), not a number of seconds: no sign in front, and a round year. */
const isDecade = (before: string, digits: string): boolean =>
  !/[+\-−]$/.test(before) && (/'$/.test(before) || /^(?:[6-9]0|(?:19|20)\d0)$/.test(digits) && !/\d$/.test(before) && Number(digits) >= 60 && (digits.length === 4 || Number(digits) >= 80));

/** Every number-then-s in a string ("+5s", "-10S") becomes the number plus <Sec />. Decades are left alone. */
export const withSec = (text: string): React.ReactNode => {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/(\d+)[sS]\b/g)) {
    const start = m.index ?? 0;
    if (isDecade(text.slice(0, start), m[1])) continue;
    out.push(text.slice(last, start + m[1].length), <Sec key={start} />);
    last = start + m[0].length;
  }
  if (out.length === 0) return text;
  out.push(text.slice(last));
  return out;
};

/**
 * The same for JSX children: text and numbers that sit side by side ("+", 25, "s") are joined
 * first, so `+{seconds}s` is caught too. Other elements pass through untouched.
 */
export const withSecChildren = (children: React.ReactNode): React.ReactNode => {
  const out: React.ReactNode[] = [];
  let text = '', changed = false;
  // A run of text stays one element (a span), so a button's flex gap can't pull "sec" away from its number.
  const flush = () => {
    if (!text) return;
    const done = withSec(text);
    if (done !== text) changed = true;
    out.push(done === text ? text : <span key={out.length} className="whitespace-nowrap">{done}</span>);
    text = '';
  };
  React.Children.toArray(children).forEach(child => {
    if (typeof child === 'string' || typeof child === 'number') { text += String(child); return; }
    flush();
    out.push(child);
  });
  flush();
  if (!changed) return children;
  return out.length === 1 ? out[0] : out;
};
