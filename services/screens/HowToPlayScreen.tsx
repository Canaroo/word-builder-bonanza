import { Sec } from '../../components/Seconds';
import React from 'react';
import { soundService } from '../soundService';
import { SCRATCH, GAMEPLAY, CHARM_BONUS, CHARM_SLOTS, CHARM_UPGRADE, CHARM_LENGTH_BOOST, PRIZE_GROWTH, BOSS, CHARM_SET_BONUS, MYSTERY_TAPE, LAST_WORDS, FINAL_JEOPARDY, HEAD_START, SKILL_SHOT, GEM_TILES, HOLD_SLOT, GRUDGE, BONES, GATES, GREATEST_HITS , TRIFORCE } from '../../config/gameplay';
import { PHOENIX_DOWN } from '../../config/progression';
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
          <p>
            <Key>{PHOENIX_DOWN.icon} {PHOENIX_DOWN.name}:</Key> a rare charm (it shows up in one charm offer a run at
            most). Take it and keep it, and if your run ends (strikes or the clock) it offers to keep you going for{' '}
            <Key>{PHOENIX_DOWN.cost} Credits</Key>: strikes wiped and {PHOENIX_DOWN.seconds} seconds on the clock. It
            works once, then it's gone. Not offered on your scored Daily Challenge.
          </p>
          <p>
            <Key>🎤 Last Words:</Key> when the run does end, the clock stops and you get one more word from your final
            hand, no rush, scored <Key>x{LAST_WORDS.multiplier}</Key>. <Key>💡 Final Jeopardy:</Key> before you play it,
            you can bet {FINAL_JEOPARDY.percents.join('% or ')}% of your score (up to {FINAL_JEOPARDY.cap.toLocaleString()}). Then a
            category is revealed, like "a double letter" or "6+ letters". If your last word fits it, you win the bet; if not, you
            lose it. Or skip the bet and just play.
          </p>
          <p>
            <Key>🎟️ Scratch-off ticket:</Key> at levels {SCRATCH.levels.join(', ')} you get a lucky ticket. Scratch a square
            to win what's under it: points, time, shuffles, a Challenge, a charm or a PowerPlay. Each new scratch replaces
            the prize you're holding, so bank it when you like it. {SCRATCH.skulls} squares hide a 💀 that wipes it; your
            first scratch is always safe.
          </p>
          <p>
            <Key>🧲 Hold slot:</Key> hold the <Key>Hold That Thought</Key> charm and a HOLD button appears above your
            tiles. Tap it, then a tile, to park that tile. It survives new hands and shuffles until you tap it back.
          </p>
          <p>
            <Key>⚔️ Grudge Match:</Key> a boss that got away from you remembers. Next time it has something to say, and
            beating it pays its badge points <Key>x{GRUDGE.multiplier}</Key>.
          </p>
          <p>
            <Key>👻 Bones:</Key> when a run ends, its last hand and charms stay behind on that level. Reach a level where
            another player fell and you may find them: spell a word of <Key>{BONES.minLetters}+ letters</Key> from their
            tiles in {BONES.seconds} seconds to take one of their charms. Yours are out there too.
          </p>
          <p>
            <Key>🛠️ Head Start:</Key> a run that ends before level {HEAD_START.untilLevel} adds{' '}
            <Key>+{HEAD_START.perRun} seconds</Key> to your next starting clock, up to +{HEAD_START.max}. Reach level{' '}
            {HEAD_START.untilLevel} and it resets. Not on your scored Daily Challenge.
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
            {Math.round(GAMEPLAY.wordTimeShrink.min * 100)}%). <Key>⏰ Overtime</Key> starts at level{' '}
            {GAMEPLAY.overtime.fromLevel}: every level after that, the clock speeds up{' '}
            {Math.round(GAMEPLAY.overtime.clockPerLevel * 100)}% more (up to x{GAMEPLAY.overtime.clockCap}) and words earn{' '}
            {Math.round(GAMEPLAY.overtime.wordTimePerLevel * 100)}% less time (down to {Math.round(GAMEPLAY.overtime.wordTimeFloor * 100)}%).
          </p>
          <p>
            <Key>Overflow tax:</Key> above {timeBank.overflowAbove}s, words add only half their time (½ on the clock).
            Bonus seconds from charms follow the same rule, and shrink{' '}
            {Math.round(timeBank.bonusShrinkPerLevel * 100)}% each level, down to half. Time from a <Key>PowerPlay</Key> always
            pays its full amount.
          </p>
          <div className="grid grid-cols-5 gap-1 text-center osd-text text-lg">
            {timeRows.map(([len, secs], i) => (
              <div key={len} className="bg-crt-800/80 rounded-md py-1">
                <div className="text-slate-400 leading-none">{len}{i === timeRows.length - 1 ? '+' : ''} LTR</div>
                <div className="text-neon-green leading-none">+{secs}<Sec /></div>
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
            <Key>🎯 Skill Shot:</Key> each new level you reach (from level {SKILL_SHOT.fromLevel}) lights one tile. Use it in your first word of the level for +
            {SKILL_SHOT.base}, growing by {SKILL_SHOT.step} for each level in a row (up to +{SKILL_SHOT.max}).{' '}
            <Key>💎 Gem tiles:</Key> a {6}-letter word turns a tile in your next hand into a x{GEM_TILES[6]} word tile, 7
            letters x{GEM_TILES[7]}, 8 or more x{GEM_TILES[8]}.{' '}
            <Key>Word Combo:</Key> five valid words in a row adds another x2. <Key>Perfect 4-Chain:</Key> four 4-letter
            words in a row pays +20, +40, +60, then a +444 jackpot.
          </p>
        </Section>

        <Section title="Pop-Culture Bonuses" icon="📼" tone="text-neon-pink">
          <p>
            Some words are secret references to 90s and 2000s movies, TV, games and music. Spell <Key>LINK</Key> or{' '}
            <Key>AIR</Key> and see what happens. Each one pays out once per run. A few are <Key>⚡ power words</Key> that
            set off an effect instead; once a level, a chip above your hand tells you when one is hiding in your tiles.
          </p>
        </Section>

        <Section title="Power-Ups" icon="✨" tone="text-neon-purple">
          <p>
            <Key>Charms</Key> are always on. They change the rules for the rest of the run ("every E is worth +
            {CHARM_BONUS.oneRing}"). Play enough words and you pick one of three. You have{' '}
            <Key>{CHARM_SLOTS} charm slots</Key>: when they're full, swap one out, pass, or <Key>⭐ upgrade</Key> one you
            hold so its point bonuses pay {CHARM_UPGRADE.percent}% more (once per charm). <Key>Long words</Key> boost
            charm points: +{CHARM_LENGTH_BOOST[5]}% on 5 letters, +{CHARM_LENGTH_BOOST[6]}% on 6, +{CHARM_LENGTH_BOOST[7]}% on 7
            and +{CHARM_LENGTH_BOOST[8]}% on 8. <Key>🧩 Charm sets</Key>: some charms belong together (the offer card
            says which). A full pair pays +{CHARM_SET_BONUS.pair} on every word. A three-charm set starts paying at two
            (+{CHARM_SET_BONUS.trioPartial}) and pays +{CHARM_SET_BONUS.trio} with all three. Your 🎒 Gear menu shows
            which sets you've started and what the next piece adds.
          </p>
          <p>
            <Key>🔺 Triforce shards</Key>. Some charm offers, scratch-off tickets and Lucky Charms hold a{' '}
            <Key>shard</Key>. Collect {TRIFORCE.shards} shards to assemble a piece. A shard does nothing on its own, but it
            never uses a charm slot, and neither does the finished piece. <Key>Power</Key>: every word scores
            x{TRIFORCE.powerMultiplier}. <Key>Wisdom</Key>: once per level, tap <Key>🔺 ASK ZELDA</Key> above your tiles
            and she puts the longest word your tiles can make ({TRIFORCE.wisdomMinLetters}+ letters) in the word row, so
            you just tap Submit. If there isn't one, she says so and you keep your ask for later (try a shuffle).{' '}
            <Key>Courage</Key>: once per level, Link takes one hit for you: your next strike is blocked, or if your clock
            runs out first you get +{TRIFORCE.courageSeconds} seconds instead (any shield you hold goes first). All three in one run:
            +{TRIFORCE.wishPoints.toLocaleString()} and the Hero of Time badge.
          </p>
          <p>
            <Key>🎒 Your Gear</Key>. Tap the Gear strip under the meters to open your gear menu (the clock pauses while
            it's open). It lists your strikes and what protects you, every charm and what it has earned this run, your
            pocket PowerPlay, anything running, your charm sets and your Triforce shards. Tap any line to read what it
            does.
          </p>
          <p>
            <Key>💔 Fragile charms</Key> (Glass Joe, Major Award, Crystal Ball, Hamm's Piggy Bank) are the strongest charms around, but the
            moment you play an invalid word or take a strike, every fragile charm you hold shatters for the rest of the
            run. Nothing protects them: not shields, not Plot Armor, not the Triforce of Courage.
          </p>
          <p>
            <Key>PowerPlays</Key> are a button you press once, at the moment you choose. Fill the meter by playing{' '}
            <Key>{GAMEPLAY.powerPlayMeterLetters} letters</Key> (or every {GAMEPLAY.powerPlayEveryWords} words) to pick one of
            three. From level {GAMEPLAY.powerPlayMeterGrowth.fromLevel} the meter gets longer each level, up to{' '}
            {GAMEPLAY.powerPlayMeterGrowth.max} letters. You can <Key>hold one</Key> in your pocket: tap its green <Key>▶ USE</Key> button above the word row when you want it (it's in your 🎒 Gear menu too). Earn another while holding one and
            you choose: <Key>keep</Key> yours or <Key>swap</Key>. Either way you still hold just one: <Key>Instant</Key> ones fire right away and replace
            the one in your pocket too. The biggest lifesavers (like Happy Place) are marked <Key>1× PER RUN</Key>: once you
            take one, it won't be offered again that run. <Key>Point prizes</Key> (gambles, Pop Quiz and the like) grow{' '}
            {Math.round(PRIZE_GROWTH.perLevel * 100)}% with each level, up to x{PRIZE_GROWTH.max}. Now and then one card is a{' '}
            <Key>📼 Mystery Tape</Key>: a face-down PowerPlay that pays +{MYSTERY_TAPE.points} points (a prize) for taking
            it blind, and +{MYSTERY_TAPE.usePoints} more when you use what was inside.
          </p>
        </Section>

        <Section title="Golden Round" icon="🌟" tone="text-neon-yellow">
          <p>
            Chain enough valid words to unlock a Golden Round: <Key>{GAMEPLAY.goldenRoundSeconds} seconds</Key> on its own
            clock while your bank waits, and no strikes. Your one word scores in full (length, charms and all), then{' '}
            <Key>x{GAMEPLAY.goldenRound.multiplier}</Key>, or <Key>x{GAMEPLAY.goldenRound.tileMultiplier}</Key> if it uses the
            glowing <Key>★ Golden Tile</Key>. The ★ GOLDEN box counts your streak; a strike resets it.
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

        <Section title="Greatest Hits" icon="📀" tone="text-neon-yellow">
          <p>
            Got a word you love? Play it again. When a word has been played as many times as it has letters, it goes platinum (once a run for each length):
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            {GREATEST_HITS.tiers.slice(0, 4).map(t => (
              <li key={t.letters}>{t.letters}-letter word, {t.letters} times: {t.icon} <Key>{t.title}</Key> +{t.points.toLocaleString()}</li>
            ))}
            <li>…and on up the charts for longer words.</li>
          </ul>
          <p>A {GREATEST_HITS.tiers[0].icon} chip above your tiles shows the word that's closest to its next record.</p>
        </Section>

        <Section title="Score Gates" icon="🚪" tone="text-neon-pink">
          <p>
            Your first word past each gate opens a one-time event (once a run), and each one pays points:
          </p>
          <p>
            <Key>{GATES.password.score.toLocaleString()}</Key> 🔐 The Password Gate: unscramble a 6-letter password in {GATES.password.seconds}<Sec /> for{' '}
            <Key>+{GATES.password.solve.toLocaleString()}</Key>.
          </p>
          <p>
            <Key>{GATES.bonusStage.score.toLocaleString()}</Key> 🌟 Bonus Stage: {GATES.bonusStage.seconds}<Sec /> with a fresh hand, every word x{GATES.bonusStage.multiplier}.
          </p>
          <p>
            <Key>{GATES.ladder.score.toLocaleString()}</Key> 🪜 The Word Ladder: climb rungs of {GATES.ladder.rungs[0]} to {GATES.ladder.rungs[GATES.ladder.rungs.length - 1]}+ letters,{' '}
            {GATES.ladder.secondsPerRung}<Sec /> each. The pot doubles every rung, up to <Key>{GATES.ladder.pots[GATES.ladder.pots.length - 1].toLocaleString()}</Key>.
            Bank it any time; miss a rung and it's gone.
          </p>
          <p>
            <Key>{GATES.bigOne.score.toLocaleString()}</Key> 💎 The Big One: the hand hides an 8-letter word. Find it in {GATES.bigOne.seconds}<Sec /> for{' '}
            <Key>+{GATES.bigOne.prizes[8].toLocaleString()}</Key> (7 letters +{GATES.bigOne.prizes[7].toLocaleString()}, 6 +{GATES.bigOne.prizes[6].toLocaleString()}).
            Just getting there earns the <Key>💎 70K Club</Key> badge for good.
          </p>
        </Section>

        <Section title="Daily Challenge" icon="📅" tone="text-neon-cyan">
          <p>
            One shared deal a day: everyone gets the <Key>same tiles, offers and bosses</Key>. Your first Play of the day asks
            whether you want the Daily Challenge or a regular game; the 📅 chip on the main screen gets you back to it later.
            Your first try is the scored one and goes on the day's board; replays are practice. Finish it for <Key>+{DAILY_RUN.finishCredits} Credits</Key>,
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
