// @vitest-environment jsdom
// Outcome headlines show seconds as "5 sec", not "5s" (the display font's S looks like a 5).
import { describe, test, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { withSec } from '../Seconds';
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
