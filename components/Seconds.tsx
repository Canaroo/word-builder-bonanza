import React from 'react';

/**
 * Text in the arcade display font can't show seconds as "5s": that font's S looks like a 5, so "+5s"
 * read as "+55" (v7.39.5). This turns every number-then-s ("+5s", "-10s") into the number plus a
 * small, lowercase "sec" in a plain font. Everything else in the text is left as it is.
 */
export const withSec = (text: string): React.ReactNode => {
  const parts = text.split(/(\d+)[sS]\b/);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 === 1
    ? <React.Fragment key={i}>{part}<span className="font-sans text-[0.45em] font-semibold lowercase tracking-wide align-baseline ml-0.5">sec</span></React.Fragment>
    : part));
};
