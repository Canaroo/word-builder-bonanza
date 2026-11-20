import React, { useEffect } from 'react';
import { soundService } from '../services/soundService';
import { FORK } from '../config/gameplay';
import { forkAdvice } from '../services/rules';
import { GAMEPLAY } from '../config/gameplay';
import { Sec } from './Seconds';

// Fork in the Road (v7.43): at the start of a new tier the highway splits. Easy Street slows the
// clock a little; the Danger Zone speeds it up and pays more on every word. The choice lasts until
// the next fork (or the end of the run after the last one).
// v7.59.0: the card reads the player's own clock (how it moved over the last level) and marks the
// route that suits it, and the Danger Zone can be left any time (hold the 🔥 chip).
export type Route = 'easy' | 'danger';
const pct = (factor: number) => Math.round(Math.abs(factor - 1) * 100);

const ForkCard: React.FC<{ level: number; delta?: number | null; clock?: number; onPick: (route: Route) => void }> = ({ level, delta = null, clock = 0, onPick }) => {
  useEffect(() => { soundService.playPowerUp(); }, []);
  const next = FORK.levels.find(l => l > level);
  // v7.61.4: say how long the pick lasts in words, and what can change before then.
  const words = next ? (next - level) * GAMEPLAY.levels.wordsPerLevel : null;
  const until = next ? `the level ${next} fork` : 'the end of the run';
  const advice = forkAdvice(delta, clock);
  const suits = (r: Route) => advice === r && (
    <span className="osd-text text-base leading-none rounded-full bg-white text-crt-900 px-2 py-0.5 mt-1">👍 SUITS YOU</span>
  );
  const deltaText = delta == null ? null : delta > 0 ? `+${delta}` : `${delta}`;
  return (
    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label="Fork in the road: pick a route">
      <div className="bg-crt-900 border-4 border-neon-cyan shadow-[0_0_28px_rgba(61,245,255,0.45)] rounded-2xl px-4 py-5 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in">
        <p className="osd-text text-lg tracking-[0.3em] text-neon-cyan">LEVEL {level} · CHECKPOINT</p>
        <h2 className="font-display text-2xl text-white leading-tight">🛣️ FORK IN THE ROAD</h2>
        <p className="text-slate-300 text-sm leading-snug">
          Pick a route. It lasts <strong className="text-white">{words ? `${words} words` : 'the rest of the run'}</strong>{words ? <> (until {until}), then you pick again</> : ' (this is the last fork)'}.
        </p>

        {/* Your clock, so the choice isn't a blind guess. */}
        <div className="w-full rounded-xl bg-crt-950/80 ring-1 ring-white/10 px-3 py-2" data-testid="fork-clock">
          <p className="osd-text text-lg leading-tight text-white">
            YOUR CLOCK: {clock}<Sec />
            {deltaText != null && (
              <> · LAST LEVEL <span className={delta! > 0 ? 'text-neon-green' : delta! < 0 ? 'text-neon-red' : 'text-slate-300'}>{deltaText}<Sec /></span></>
            )}
          </p>
          <p className="text-xs text-slate-400 leading-snug mt-0.5">
            {advice === 'danger' ? "You're ahead of the clock: the Danger Zone should pay off."
              : advice === 'easy' ? 'Your clock is slipping: Easy Street keeps the run alive.'
              : "Close call. Danger pays more, but only if you can keep up."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full">
          <button type="button" onClick={() => onPick('easy')} aria-label={`Easy Street: clock ${pct(FORK.easy.clock)}% slower, normal points, locked in until ${until}${advice === 'easy' ? '. Suits you.' : ''}`}
            className={`rounded-xl p-3 ring-2 ring-neon-green bg-neon-green/10 hover:bg-neon-green/20 flex flex-col items-center gap-1 outline-none focus-visible:ring-white ${advice === 'easy' ? 'ring-4 shadow-[0_0_18px_rgba(57,255,20,0.45)]' : ''}`}>
            <span className="text-4xl leading-none" aria-hidden="true">🌴</span>
            <span className="font-display text-base text-neon-green leading-tight">EASY STREET</span>
            <span className="osd-text text-lg text-white leading-tight">CLOCK {pct(FORK.easy.clock)}% SLOWER</span>
            <span className="osd-text text-lg text-slate-300 leading-tight">NORMAL POINTS</span>
            <span className="text-xs text-slate-300 leading-snug mt-1">🔒 Locked in until {next ? `level ${next}` : 'the end'}: no switching to Danger.</span>
            {suits('easy')}
          </button>
          <button type="button" onClick={() => onPick('danger')} aria-label={`Danger Zone: clock ${pct(FORK.danger.clock)}% faster, points times ${FORK.danger.points}. You can cool off to Easy Street any time, with no way back in.${advice === 'danger' ? ' Suits you.' : ''}`}
            className={`rounded-xl p-3 ring-2 ring-neon-red bg-neon-red/10 hover:bg-neon-red/20 flex flex-col items-center gap-1 outline-none focus-visible:ring-white ${advice === 'danger' ? 'ring-4 shadow-[0_0_18px_rgba(255,60,60,0.5)]' : ''}`}>
            <span className="text-4xl leading-none" aria-hidden="true">🔥</span>
            <span className="font-display text-base text-neon-red leading-tight">DANGER ZONE</span>
            <span className="osd-text text-lg text-white leading-tight">CLOCK {pct(FORK.danger.clock)}% FASTER</span>
            <span className="osd-text text-lg text-neon-yellow leading-tight">EVERY WORD x{FORK.danger.points}</span>
            <span className="text-xs text-slate-300 leading-snug mt-1">🌴 Hold the 🔥 chip to escape to Easy Street any time. No way back in.</span>
            {suits('danger')}
          </button>
        </div>
        <p className="text-sm text-slate-300 leading-snug">🔥 <strong className="text-white">Not a trap:</strong> in the Danger Zone, <strong className="text-neon-yellow">hold the 🔥 chip</strong> above your tiles to cool off to Easy Street any time{words ? ` in the next ${words} words` : ''}. Once you cool off, you stay on Easy Street until {until}.</p>
      </div>
    </div>
  );
};

export default ForkCard;
