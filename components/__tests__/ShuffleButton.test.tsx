// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ShuffleButton from '../ShuffleButton';

const render = (props: Partial<React.ComponentProps<typeof ShuffleButton>> = {}) => renderToString(
    <ShuffleButton count={2} seconds={5} disabled={false} lowTime={false} timerRef={{ current: null }} onShuffle={() => {}} {...props} />,
);

describe('Shuffle lifeline button', () => {
    test('says it adds time and shows shuffles left as a number, like Challenge', () => {
        const html = render();
        expect(html).toContain('+<!-- -->5<!-- --> SEC');
        expect(html).toContain('2 left');
        expect(html).toContain('🔀 Shuffle (2)');
        expect(html).not.toContain('rounded-full');
    });

    test('pulses only when time is low and a shuffle is available', () => {
        expect(render({ lowTime: true })).toContain('lifeline-pulse');
        expect(render({ lowTime: false })).not.toContain('lifeline-pulse');
        expect(render({ lowTime: true, disabled: true })).not.toContain('lifeline-pulse');
    });

    test('any count reads the same way, including none', () => {
        expect(render({ count: 7 })).toContain('🔀 Shuffle (7)');
        expect(render({ count: 0, disabled: true })).toContain('🔀 Shuffle (0)');
    });
});
