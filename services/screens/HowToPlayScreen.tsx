import React from 'react';
import { soundService } from '../soundService';

interface HowToPlayScreenProps {
  onBack: () => void;
}

const RuleItem: React.FC<{ title: string; children: React.ReactNode, icon: string, colorClass: string }> = ({ title, children, icon, colorClass }) => (
  <div>
    <h2 className={`text-xl font-bold ${colorClass} mb-2 flex items-center gap-2`}>
      <span className="text-2xl">{icon}</span>
      <span>{title}</span>
    </h2>
    <div className="pl-9 text-slate-300 space-y-2">{children}</div>
  </div>
);


const HowToPlayScreen: React.FC<HowToPlayScreenProps> = ({ onBack }) => {
  
  const handleBackClick = () => {
    soundService.playUIClick();
    onBack();
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 p-6 md:p-8 text-left justify-between animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold text-center text-amber-400 mb-6">The Lowdown</h1>

        <div className="space-y-5 text-slate-200 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
          
          <RuleItem title="The Basics" icon="🎯" colorClass="text-cyan-400">
            <p>
              Build words (3+ letters) from your tiles. Submit before the timer ends! Longer words and rare letters (J, Q, Z) score more. Use all your tiles in one word for a massive <strong className="text-amber-300">Super Hand</strong> bonus!
            </p>
            <p>
              <strong className="text-red-400">Watch the clock!</strong> If the timer hits zero, the game ends instantly. Invalid words cost a strike — <strong className="text-red-400">3 strikes and you're out!</strong>
            </p>
          </RuleItem>

          <RuleItem title="Game Changers" icon="✨" colorClass="text-cyan-400">
            <p>
                <strong className="text-yellow-400">Word Combos:</strong> Play words consecutively for a score bonus! At 5 words in a row, your word's score is <strong className="text-yellow-400">DOUBLED!</strong> You'll get notifications for your streaks. Don't break your combo!
            </p>
            <p>
              <strong className="text-amber-300">Charms & PowerPlays:</strong> Earn these as you play. Charms give passive buffs and PowerPlays are powerful one-shot abilities. Choose wisely to boost your score!
            </p>
          </RuleItem>

          <RuleItem title="Golden Round" icon="🌟" colorClass="text-yellow-400">
            <p>
              Chain together valid words to start a <strong className="text-yellow-300">Golden Round!</strong> This is a special, untimed round with huge scoring potential.
            </p>
            <ul className="list-disc list-inside mt-1 text-sm space-y-1">
                <li>All tiles are worth <strong className="text-green-400">2x points</strong>.</li>
                <li>One special <strong className="text-yellow-300">Golden Tile</strong> is chosen in your hand.</li>
                <li>Using the Golden Tile in a word multiplies that word's score by <strong className="text-green-400">6x!</strong></li>
            </ul>
          </RuleItem>

          <RuleItem title="The Perfect 4-Chain" icon="⛓️" colorClass="text-cyan-400">
            <p>
              Playing consecutive 4-letter words triggers a stacking point bonus. The chain builds with each word:
            </p>
            <ul className="list-disc list-inside mt-1 text-sm space-y-1">
              <li>1st Word: <strong className="text-green-400">+20</strong> points</li>
              <li>2nd Word: <strong className="text-green-400">+40</strong> points</li>
              <li>3rd Word: <strong className="text-green-400">+60</strong> points</li>
            </ul>
            <p className="mt-2">
              Land a fourth 4-letter word in a row to complete a <strong className="text-amber-300">Perfect 4-Chain</strong> and earn a massive <strong className="text-amber-300">+444 point bonus</strong> on top of the standard +80 streak points! The chain resets after a perfect chain, or if you play a word of a different length.
            </p>
          </RuleItem>
          
          <RuleItem title="Daily Power Word" icon="💥" colorClass="text-yellow-400">
            <p>
              Spin once a day from the main menu to get your unique 4-letter <strong className="text-amber-300">Power Word</strong>.
            </p>
            <p>
              Successfully play this exact word during a game to earn an instant <strong className="text-green-400">500 point bonus!</strong> This bonus can only be claimed <strong className="text-yellow-300">once per game run</strong>. The spin resets daily at 8:00 AM.
            </p>
          </RuleItem>

          <RuleItem title="Your Toolkit" icon="🛠️" colorClass="text-cyan-400">
            <p>
              <strong className="text-white">Shuffle:</strong> Bad hand? Swap your tiles. Uses are limited!
            </p>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-600">
              <p>
                <strong className="text-sky-400">Challenge:</strong> Think you're stuck? Hit Challenge!
              </p>
              <ul className="list-disc list-inside mt-1 text-sm">
                <li><strong className="text-green-400">WIN:</strong> No word found? You get a FREE shuffle.</li>
                <li><strong className="text-red-400">LOSE:</strong> A word was possible. You must play it for 0 points and you lose a challenge charge.</li>
              </ul>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-red-500/50">
                <p><strong className="text-red-500">Strike Challenge:</strong> Out of normal challenges? Gamble a strike! Win for a free shuffle, lose and you take a strike penalty. High risk, high reward!</p>
            </div>
          </RuleItem>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={handleBackClick}
          className="w-full px-6 py-4 text-2xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 transition-all duration-300 transform hover:scale-105"
        >
          Got It, Let's Play!
        </button>
      </div>
    </div>
  );
};

export default HowToPlayScreen;