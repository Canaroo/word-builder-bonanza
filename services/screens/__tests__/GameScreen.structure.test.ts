import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// GameScreen.tsx holds the game logic; GameScreenView.tsx holds the layout.
// Keeping them apart lets the visual refresh change the view without touching game rules.
const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('GameScreen structure', () => {
    test('GameScreen.tsx renders through <GameScreenView />', () => {
        expect(read('GameScreen.tsx')).toMatch(/return <GameScreenView \{\.\.\.viewProps\} \/>;/);
    });
});
