// Event log titles don't repeat the icon shown beside them.
import { describe, test, expect } from 'vitest';
import { eventTitle } from '../EventLogDisplay';

describe('eventTitle', () => {
    test('drops the icon at the start and a matching one at the end', () => {
        expect(eventTitle('💉', '💉 “Heroes Never Die!” 💉')).toBe('“Heroes Never Die!”');
        expect(eventTitle('❄️', '❄️ “Do You Want to Build a Snowman?” ❄️')).toBe('“Do You Want to Build a Snowman?”');
    });
    test('keeps a different trailing emoji and plain names as they are', () => {
        expect(eventTitle('🏢', '🏢 “The Dundie Award” 🏆')).toBe('“The Dundie Award” 🏆');
        expect(eventTitle('💍', 'One Tile to Rule Them All')).toBe('One Tile to Rule Them All');
        expect(eventTitle(undefined, 'Charm Swap')).toBe('Charm Swap');
    });
});
