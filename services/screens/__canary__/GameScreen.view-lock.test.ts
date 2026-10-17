import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// GameScreen.tsx holds the game logic and renders through <GameScreenView />,
// which holds the game-screen layout between the view-lock sentinels.
const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('GameScreen view-lock', () => {
    test('GameScreenView.tsx keeps both view-lock sentinels', () => {
        const view = read('GameScreenView.tsx');
        expect(view).toContain('// ⛔ VIEW-LOCK: DO NOT EDIT ABOVE THIS LINE');
        expect(view).toContain('// ⛔ VIEW-LOCK: DO NOT EDIT BELOW THIS LINE');
    });

    test('GameScreen.tsx renders through <GameScreenView />', () => {
        const screen = read('GameScreen.tsx');
        expect(screen).toMatch(/return <GameScreenView \{\.\.\.viewProps\} \/>;/);
    });
});
