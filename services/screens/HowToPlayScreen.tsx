import React from 'react';
import { soundService } from '../soundService';
import { GAMEPLAY, CHARM_BONUS, CHARM_SLOTS } from '../../config/gameplay';
import ArcadeButton from '../../components/ArcadeButton';

interface HowToPlayScreenProps {
  onBack: () => void;
}

// Styled like the instruction booklet that came in the cartridge box.
const Section: React.FC<{ title: string; icon: string; tone: string; children: React.ReactNode }> = ({ title, icon, tone, children }) => (
  <section className="bg-crt-950/70 ring-1 ring-white/10 rounded-xl p-4 text-left">
    <h2 className={`font-display text-lg mb-2 flex items-center gap-2 ${tone}`}>
      <span aria-hidden="true">{icon}</span>
      <span>{title}</span>
    </h2>
    <div className="space-y-2 text-slate-200 text-[15px] leading-snug">{children}</div>
  </section>
);

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <strong className="text-neon-yellow font-semibold">{children}</strong>
);

const { timeBank } = GAMEPLAY;
const timeRows = Object.entries(timeBank.secondsByLength);
const lengthRows = Object.entries(GAMEPLAY.lengthMultipliers);

const HowToPlayScreen: React.FC<HowToPlayScreenProps> = ({ onBack }) => {
  const handleBackClick = () => {
    soundService.playUIClick();
    onBack();
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-4">
      <div className="text-center shrink-0 mb-3">
        <h1 className="font-display text-4xl neon-text-cyan">HOW TO PLAY</h1>
        <p className="osd-text text-lg text-neon-pink">INSTRUCTION BOOKLET · PLEASE READ</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 pr-1">
        <Section title="The Basics" icon="🎯" tone="text-neon-cyan">
          <p>
            Tap tiles to spell words of <Key>3+ letters</Key>, then hit <Key>Submit</Key>. Your hand always refills to{' '}
            <Key>{GAMEPLAY.handSize} tiles</Key>. Rare letters (J, Q, X, Z) score big, and using every tile earns a{' '}
            <Key>Super Hand</Key> bonus.
          </p>
          <p>
            Invalid words cost a <Key>strike</Key>. Three strikes and it's game over. Strikes stick: only{' '}
            <Key>PowerPlays</Key> and <Key>charms</Key> can take one back or block it.
          </p>
        </Section>

        <Section title="The Clock Is a Bank" icon="⏱️" tone="text-neon-green">
          <p>
            You start with <Key>{timeBank.start} seconds</Key> and the clock never resets. Every valid word{' '}
            <Key>adds time</Key>, so longer words keep you alive. An invalid word costs <Key>{timeBank.invalidPenalty}s</Key>.
            The bank tops out at {timeBank.max}s. When it hits zero, the run ends.
          </p>
          <p>
            <Key>Lifeline:</Key> every shuffle adds <Key>+{timeBank.shuffleTimeBonus}s</Key>. You only get a few, so save
            them for when the clock gets tight.
          </p>
          <p>
            <Key>Speed-up levels:</Key> every {GAMEPLAY.levels.wordsPerLevel} words the level goes up and the clock runs{' '}
            {Math.round(GAMEPLAY.levels.speedUpPerLevel * 100)}% faster (up to x{GAMEPLAY.levels.maxSpeed}). From level{' '}
            {timeBank.shortWordTimeStopsAtLevel}, 3-letter words add no time.
          </p>
          <p>
            <Key>Overflow tax:</Key> above {timeBank.overflowAbove}s, words add only half their time (½ on the clock).
            Bonus seconds from charms and PowerPlays follow the same rule, and shrink{' '}
            {Math.round(timeBank.bonusShrinkPerLevel * 100)}% each level, down to half.
          </p>
          <div className="grid grid-cols-5 gap-1 text-center osd-text text-lg">
            {timeRows.map(([len, secs], i) => (
              <div key={len} className="bg-crt-800/80 rounded-md py-1">
                <div className="text-slate-400 leading-none">{len}{i === timeRows.length - 1 ? '+' : ''} LTR</div>
                <div className="text-neon-green leading-none">+{secs}s</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Scoring" icon="💯" tone="text-neon-yellow">
          <p>Longer words multiply your score:</p>
          <div className="grid grid-cols-5 gap-1 text-center osd-text text-lg">
            {lengthRows.map(([len, mult], i) => (
              <div key={len} className="bg-crt-800/80 rounded-md py-1">
                <div className="text-slate-400 leading-none">{len}{i === lengthRows.length - 1 ? '+' : ''} LTR</div>
                <div className="text-neon-yellow leading-none">x{mult}</div>
              </div>
            ))}
          </div>
          <p>
            Multipliers from length, charms, PowerPlays and combos <Key>add together</Key>: x2 and x4 make x6. Coin-flip
            gambles like Double or Nothing multiply the final score.
          </p>
          <p>
            <Key>Word Combo:</Key> five valid words in a row adds another x2. <Key>Perfect 4-Chain:</Key> four 4-letter
            words in a row pays +20, +40, +60, then a +444 jackpot.
          </p>
        </Section>

        <Section title="Pop-Culture Bonuses" icon="📼" tone="text-neon-pink">
          <p>
            Some words are secret references to 90s and 2000s movies, TV, games and music. Spell <Key>LINK</Key> or{' '}
            <Key>AIR</Key> and see what happens. Each one pays out once per run.
          </p>
        </Section>

        <Section title="Power-Ups" icon="✨" tone="text-neon-purple">
          <p>
            <Key>Charms</Key> are always on. They change the rules for the rest of the run ("every E is worth +
            {CHARM_BONUS.oneRing}"). Play enough words and you pick one of three. You have{' '}
            <Key>{CHARM_SLOTS} charm slots</Key>: when they're full, swap one out or pass.
          </p>
          <p>
            <Key>PowerPlays</Key> are a button you press once, at the moment you choose. Fill the meter by playing{' '}
            <Key>{GAMEPLAY.powerPlayMeterLetters} letters</Key> (or every {GAMEPLAY.powerPlayEveryWords} words) to pick one of
            three. You can <Key>hold one</Key> in your Buffs tray; tap it to use it. Earn another while holding one and
            you choose: <Key>keep</Key> yours or <Key>swap</Key>. Either way you still hold just one: <Key>Instant</Key> ones fire right away and replace
            the one in your pocket too. The biggest lifesavers (like Happy Place) are marked <Key>1× PER RUN</Key>: once you
            take one, it won't be offered again that run.
          </p>
        </Section>

        <Section title="Golden Round" icon="🌟" tone="text-neon-yellow">
          <p>
            Chain enough valid words to unlock a Golden Round: <Key>{GAMEPLAY.goldenRoundSeconds} seconds</Key> on its own
            clock while your bank waits, all tiles worth <Key>2x</Key>, and a <Key>Golden Tile</Key> worth a{' '}
            <Key>6x</Key> word score.
          </p>
        </Section>

        <Section title="Your Toolkit" icon="🛠️" tone="text-neon-cyan">
          <p><Key>Shuffle:</Key> a fresh hand plus <Key>+{timeBank.shuffleTimeBonus}s</Key>, and your streaks keep going. Uses are limited: some charms, PowerPlays and secret bonuses give you more.</p>
          <p>
            <Key>Challenge:</Key> stuck? If no everyday word can be made, you win a free shuffle. If one can, you must play it
            for 0 points.
          </p>
          <p><Key>Strike Challenge:</Key> out of challenges? Gamble a strike for the same deal.</p>
        </Section>

        <Section title="Daily Power Word" icon="💥" tone="text-neon-orange">
          <p>
            Spin once a day on the main menu for a 4-letter <Key>Power Word</Key>. Play it during a run for{' '}
            <Key>+500</Key> (once per run). The spin resets daily at 8:00 AM.
          </p>
        </Section>
      </div>

      <div className="shrink-0 pt-3">
        <ArcadeButton color="yellow" size="lg" className="w-full" onClick={handleBackClick}>
          ▶ Got It, Let's Play
        </ArcadeButton>
      </div>
    </div>
  );
};

export default HowToPlayScreen;
