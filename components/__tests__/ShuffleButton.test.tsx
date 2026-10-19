// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ShuffleButton from '../ShuffleButton';

const render = (props: Partial<React.ComponentProps<typeof ShuffleButton>> = {}) => renderToString(
    <ShuffleButton count={2} seconds={5} disabled={false} lowTime={false} timerRef={{ current: null }} onShuffle={() => {}} {...props} />,
);

describe('Shuffle lifeline button', () => {
    test('says it adds time and shows shuffles left as dots', () => {
        const html = render();
        expect(html).toContain('+<!-- -->5<!-- --> SEC');
        expect(html).toContain('2 left');
        expect(html.match(/w-2 h-2 rounded-full/g)).toHaveLength(3); // 2 filled + 1 used of the starting 3
    });

    test('pulses only when time is low and a shuffle is available', () => {
        expect(render({ lowTime: true })).toContain('lifeline-pulse');
        expect(render({ lowTime: false })).not.toContain('lifeline-pulse');
        expect(render({ lowTime: true, disabled: true })).not.toContain('lifeline-pulse');
    });

    test('lots of shuffles show as a count instead of dots', () => {
        expect(render({ count: 7 })).toContain('×<!-- -->7');
    });
});
