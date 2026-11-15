// @vitest-environment jsdom
// Outcome headlines show seconds as "5 sec", not "5s" (the display font's S looks like a 5).
import { describe, test, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { withSec, withSecChildren, Sec } from '../Seconds';
import ArcadeButton from '../ArcadeButton';
import OutcomeCard from '../OutcomeCard';

const text = (node: React.ReactNode) => renderToString(<p>{node}</p>).replace(/<[^>]+>/g, '');

describe('withSec', () => {
  test('a number then s becomes the number and "sec"', () => {
    expect(text(withSec('+300 POINTS, +5s'))).toBe('+300 POINTS, +5sec');
    expect(text(withSec('TOO SLOW: -10s'))).toBe('TOO SLOW: -10sec');
    expect(renderToString(<p>{withSec('+5s')}</p>)).toContain('>sec</span>');
  });
  test('words ending in s and plain numbers are left alone', () => {
    expect(withSec('+300 POINTS')).toBe('+300 POINTS');
    expect(withSec('CARDS: 3')).toBe('CARDS: 3');
  });
  test('the outcome card uses it', () => {
    const html = renderToString(<OutcomeCard name="Pop Quiz, Hotshot" detail="You answered in 3 seconds." data={{ icon: '🚌', headline: '+300 POINTS, +5s', tone: 'win' }} onClose={() => {}} />);
    expect(html).toContain('>sec</span>');
  });
});

describe('seconds in the arcade fonts (v7.44.4)', () => {
  const html = (node: React.ReactNode) => renderToString(<p>{node}</p>);
  test('uppercase S after a number is caught too', () => {
    expect(html(withSec('TAKE +25S'))).toContain('>sec</span>');
    expect(html(withSec('TAKE +25S'))).not.toMatch(/25S/);
  });
  test('JSX pieces side by side are joined first: +{n}s', () => {
    const out = html(withSecChildren(['+', 25, 's']));
    expect(out).toContain('>sec</span>');
    expect(out).not.toMatch(/25s/);
    // Other elements pass through, and plain text is left alone.
    expect(html(withSecChildren(['Take ', <b key="b">this</b>, ' now']))).toContain('<b>this</b>');
    expect(html(withSecChildren('Pass: keep my 5'))).not.toContain('sec');
    // Decades are not seconds: the '90s Throwback theme keeps its name.
    expect(html(withSecChildren("Buy '90s Throwback"))).not.toContain('sec');
    expect(html(withSec('80s and 2000s movies'))).not.toContain('sec');
    expect(html(withSec('+90s'))).toContain('>sec</span>');
  });
  test('every arcade button is covered', () => {
    const out = renderToString(<ArcadeButton>{`Take +${25}s`}</ArcadeButton>);
    expect(out).toContain('>sec</span>');
    expect(out).not.toMatch(/25s/);
    expect(renderToString(<ArcadeButton variant="outline">{`Take the ${-8}s`}</ArcadeButton>)).toContain('>sec</span>');
  });
  test('<Sec /> is the small plain-font label', () => {
    expect(renderToString(<Sec />)).toMatch(/font-sans[^>]*>sec</);
  });
});
