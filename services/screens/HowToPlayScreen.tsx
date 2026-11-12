import React from 'react';
import { soundService } from '../soundService';
import { GAMEPLAY, CHARM_BONUS, CHARM_SLOTS, CHARM_UPGRADE, CHARM_LENGTH_BOOST, PRIZE_GROWTH, BOSS } from '../../config/gameplay';
import { DAILY_RUN, DAILY_RESET_HOUR } from '../../config/progression';
import ArcadeButton from '../../components/ArcadeButton';
import ScreenShell from '../../components/ScreenShell';

interface HowToPlayScreenProps {
  onBack: () => void;
}

// Styled like the instruction booklet that came in the cartridge box. Each section folds (v7.31),
// so the booklet scans in one screen; tap a title to open it.
const Section: React.FC<{ title: string; icon: string; tone: string; open?: boolean; children: React.ReactNode }> = ({ title, icon, tone, open = false, children }) => (
  <details open={open} className="group bg-crt-950/70 ring-1 ring-white/10 rounded-xl text-left">
    <summary className={`list-none cursor-pointer select-none font-display text-lg px-4 py-3 flex items-center gap-2 ${tone}`} onClick={() => soundService.playUIClick()}>
      <span aria-hidden="true">{icon}</span>
      <span className="flex-1">{title}</span>
      <span className="text-slate-500 text-sm transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
    </summary>
    <div className="space-y-2 text-slate-200 text-[15px] leading-snug px-4 pb-4">{children}</div>
  </details>
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
    <ScreenShell title="HOW TO PLAY" onBack={onBack}>
      <div className="space-y-2 max-w-lg mx-auto">
        <Section title="The Basics" icon="🎯" tone="text-neon-cyan" open>
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
            them for when the clock gets tight. <Key>Press and hold</Key> Shuffle until the bar fills, so a stray tap
            never wastes one.
          </p>
          <p>
            <Key>Speed-up levels:</Key> every {GAMEPLAY.levels.wordsPerLevel} words the level goes up and the clock runs{' '}
            {Math.round(GAMEPLAY.levels.speedUpPerLevel * 100)}% faster. From level {timeBank.shortWordTimeStopsAtLevel}, 3-letter
            words add no time. After level {GAMEPLAY.levels.lateFromLevel} it gets serious: the clock speeds up{' '}
            {Math.round(GAMEPLAY.levels.lateSpeedUpPerLevel * 100)}% a level (up to x{GAMEPLAY.levels.maxSpeed}), and words earn{' '}
            {Math.round(GAMEPLAY.wordTimeShrink.perLateLevel * 100)}% less time each level (down to{' '}
            {Math.round(GAMEPLAY.wordTimeShrink.min * 100)}%).
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
            <Key>{CHARM_SLOTS} charm slots</Key>: when they're full, swap one out, pass, or <Key>⭐ upgrade</Key> one you
            hold so its point bonuses pay {CHARM_UPGRADE.percent}% more (once per charm). <Key>Long words</Key> boost
            charm points: +{CHARM_LENGTH_BOOST[5]}% on 5 letters, +{CHARM_LENGTH_BOOST[6]}% on 6, +{CHARM_LENGTH_BOOST[7]}% on 7
            and +{CHARM_LENGTH_BOOST[8]}% on 8.
          </p>
          <p>
            <Key>PowerPlays</Key> are a button you press once, at the moment you choose. Fill the meter by playing{' '}
            <Key>{GAMEPLAY.powerPlayMeterLetters} letters</Key> (or every {GAMEPLAY.powerPlayEveryWords} words) to pick one of
            three. From level {GAMEPLAY.powerPlayMeterGrowth.fromLevel} the meter gets longer each level, up to{' '}
            {GAMEPLAY.powerPlayMeterGrowth.max} letters. You can <Key>hold one</Key> in your Buffs tray; tap it to use it. Earn another while holding one and
            you choose: <Key>keep</Key> yours or <Key>swap</Key>. Either way you still hold just one: <Key>Instant</Key> ones fire right away and replace
            the one in your pocket too. The biggest lifesavers (like Happy Place) are marked <Key>1× PER RUN</Key>: once you
            take one, it won't be offered again that run. <Key>Point prizes</Key> (gambles, Pop Quiz and the like) grow{' '}
            {Math.round(PRIZE_GROWTH.perLevel * 100)}% with each level, up to x{PRIZE_GROWTH.max}.
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

        <Section title="Missions, Streaks & Shop" icon="🔥" tone="text-neon-orange">
          <p>
            Every day brings <Key>3 new missions</Key>: a mix of word-building, PowerPlay, charm and secret-finding
            goals (easy, medium and hard). Each pays <Key>credits</Key>, with a bonus for finishing all three. They
            reset at 8:00 AM.
          </p>
          <p>
            <Key>Finish a run each day</Key> to grow your 🔥 streak. Milestones at 3, 7, 14, 21, 30, 50, 60 and 100
            days unlock titles, badges, credits and an exclusive theme. A <Key>Streak Freeze</Key> covers a missed day.
          </p>
          <p>
            Spend credits in the <Key>Vibez Shop</Key> on themes, badges and titles. Your badge, title and streak show
            on the Top 50 and your share card.
          </p>
        </Section>

        <Section title="Boss Rounds" icon="👹" tone="text-neon-red">
          <p>
            Every <Key>{BOSS.everyLevels}rd level</Key> a villain shows up with a rule (like <Key>no E</Key>) for your next{' '}
            <Key>{BOSS.words} words</Key>. Land <Key>{BOSS.hitsToWin} hits</Key> (words that follow the rule) to win their{' '}
            <Key>Boss Badge</Key>, worth points and time (the toughest rules need fewer hits). Breaking the rule never costs you: the word still scores.
          </p>
        </Section>

        <Section title="Today's Run" icon="📅" tone="text-neon-cyan">
          <p>
            One shared deal a day: everyone gets the <Key>same tiles, offers and bosses</Key>. Your first daily run is the
            scored one and goes on the day's board; replays are practice. Finish it for <Key>+{DAILY_RUN.finishCredits} Credits</Key>,
            plus <Key>+{DAILY_RUN.topCredits}</Key> for a top-{DAILY_RUN.topRank} finish. It resets at {DAILY_RESET_HOUR}:00 AM.
          </p>
        </Section>

        <Section title="Daily Power Word" icon="💥" tone="text-neon-orange">
          <p>
            Spin once a day on the main menu for a 4-letter <Key>Power Word</Key>. Play it during a run for{' '}
            <Key>+500</Key>, plus 50 for every day of your streak (up to +1,000), once per run. The spin resets daily at
            8:00 AM.
          </p>
        </Section>

        <ArcadeButton color="yellow" className="w-full !mt-4" onClick={handleBackClick}>
          ▶ Got It, Let's Play
        </ArcadeButton>
      </div>
    </ScreenShell>
  );
};

export default HowToPlayScreen;
