import ArcadeButton from './ArcadeButton';
import React from 'react';

interface RankingModalProps {
  data: { rank: number; name: string; score: number };
  onClose: () => void;
  onShowLeaderboard: () => void;
}

const RankingModal: React.FC<RankingModalProps> = ({ data, onClose, onShowLeaderboard }) => {
  let config: {
    title: string;
    message: string;
    icon: string;
    modalClass: string;
    decorativeElement?: React.ReactNode;
  };

  switch (true) {
    case data.rank === 1:
      config = {
        title: "A Winner Is You!",
        message: "You just did it. No bugs, no continues, no cheat codes—just pure skill. A WINNER IS YOU.",
        icon: "🏆",
        modalClass: "border-yellow-400 bg-slate-900",
        decorativeElement: (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-5xl z-20" style={{ textShadow: '0px 0px 10px #fde047' }}>👑</div>
        ),
      };
      break;
    case data.rank <= 5:
      config = {
        title: "You Either Win…",
        message: "You either win in the Top 5… or you wait long enough to become #1.",
        icon: "🦇",
        modalClass: "border-slate-500 bg-gray-900 shadow-lg shadow-sky-400/20",
        decorativeElement: (
          <div className="absolute inset-0 flex items-center justify-center -z-10">
            <div className="text-9xl text-slate-700/50 bat-silhouette-animation">🦇</div>
          </div>
        ),
      };
      break;
    case data.rank <= 10:
      config = {
        title: "Not Throwing Away My Spot.",
        message: "You made the Top 10. You’re young, scrappy, and hungry—and not throwin’ away your shot.",
        icon: "✨",
        modalClass: "border-amber-600 modal-parchment",
        decorativeElement: (
            <div className="absolute inset-0 overflow-hidden">
                {[...Array(5)].map((_, i) => (
                    <div 
                      key={i} 
                      className="absolute sparkle text-2xl" 
                      style={{ 
                        left: `${10 + i * 18}%`, 
                        bottom: '20%',
                        animationDelay: `${i * 0.2}s`
                      }}>✨</div>
                ))}
            </div>
        )
      };
      break;
    default:
      // Should not happen if component is rendered correctly
      return null;
  }

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className={`relative bg-crt-900 border-2 rounded-2xl p-6 shadow-2xl max-w-md w-full flex flex-col max-h-[90vh] text-center overflow-hidden bonus-insert ${config.modalClass}`}>
        {config.decorativeElement}
        <div className="relative z-10">
            <h2 className="font-display text-3xl text-neon-yellow drop-shadow-glow-yellow mb-2">{config.icon} {config.title}</h2>
            
            <div className="my-6">
                <p className="font-osd text-4xl uppercase tracking-widest neon-text-cyan">{data.name}</p>
                <p className="osd-text text-2xl text-slate-200">RANK #{data.rank}</p>
                <p className="font-osd text-4xl text-neon-yellow mt-1 tabular-nums">{data.score.toLocaleString()} PTS</p>
            </div>
            
            <p className="text-slate-300 italic mb-6">"{config.message}"</p>

            <div className="space-y-3">
                <ArcadeButton color="cyan" className="w-full" onClick={onShowLeaderboard}>🏆 View Top 50</ArcadeButton>
                <ArcadeButton color="slate" size="sm" className="w-full" onClick={onClose}>Close</ArcadeButton>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RankingModal;
