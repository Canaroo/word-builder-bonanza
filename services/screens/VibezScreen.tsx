
import React from 'react';
import { soundService } from '../soundService';
import { PACKS_LIST } from '../../data/packs';
import { Pack } from '../../types';

interface VibezScreenProps {
  onBack: () => void;
  lexCoins: number;
  unlockedPackIds: string[];
  selectedPackId: string;
  onUnlockPack: (packId: string, cost: number) => void;
  onSelectPack: (packId: string) => void;
}

const VibezScreen: React.FC<VibezScreenProps> = ({ 
    onBack, 
    lexCoins, 
    unlockedPackIds, 
    selectedPackId,
    onUnlockPack,
    onSelectPack
}) => {
  const handleBackClick = () => {
    soundService.playUIClick();
    onBack();
  };
  
  const handleSelect = (pack: Pack) => {
    soundService.playUIClick();
    onSelectPack(pack.id);
  };

  const handleUnlock = (pack: Pack) => {
    soundService.playUIClick();
    onUnlockPack(pack.id, pack.cost);
  };

  const renderPackButton = (pack: Pack) => {
    const isUnlocked = unlockedPackIds.includes(pack.id);
    const isSelected = selectedPackId === pack.id;
    const canAfford = lexCoins >= pack.cost;

    if (isSelected) {
      return <button disabled className="w-full mt-auto px-3 py-2 text-md font-bold text-slate-900 bg-slate-600 rounded-md cursor-not-allowed">SELECTED</button>;
    }

    if (isUnlocked) {
      return <button onClick={() => handleSelect(pack)} className="w-full mt-auto px-3 py-2 text-md font-bold text-slate-900 bg-purple-400 rounded-md hover:bg-purple-300">SELECT</button>;
    }

    // Not unlocked
    return (
      <button 
        onClick={() => handleUnlock(pack)} 
        disabled={!canAfford}
        className="w-full mt-auto px-3 py-2 text-md font-bold text-slate-900 bg-green-500 rounded-md hover:bg-green-400 disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed"
      >
        <span className="flex items-center justify-center gap-2">
          UNLOCK <span>🪙 {pack.cost}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 p-4 md:p-6 text-left justify-between animate-fade-in">
      <div>
        <div className="text-center mb-4">
            <h1 className="text-4xl font-bold text-purple-400 tracking-tighter">VIBEZ</h1>
            <p className="text-slate-300 -mt-1">Unlock new looks for your game.</p>
        </div>

        <div className="text-center mb-1 bg-slate-900/50 p-3 rounded-lg flex justify-center items-center gap-2">
            <span className="text-2xl font-bold text-yellow-400">Your LEX Coins:</span>
            <div className="flex items-center gap-1 text-yellow-400 font-digital text-3xl">
              <span>🪙</span>
              <span>{lexCoins}</span>
            </div>
        </div>
        <p className="text-center text-xs text-slate-400 mb-6">Earn 1 🪙 for every 5,000 points scored in a run.</p>

        <div className="overflow-y-auto max-h-[calc(100vh-380px)] p-2 -m-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PACKS_LIST.map(pack => {
              const isSelected = selectedPackId === pack.id;
              return (
                <div key={pack.id} className={`bg-slate-900/50 p-3 rounded-lg text-center flex flex-col justify-between transition-all ${isSelected ? 'ring-2 ring-purple-400' : ''}`}>
                  <div>
                    <div className={`w-full h-24 rounded-md mb-2 ${pack.previewClass}`}></div>
                    <h3 className="font-bold text-white mb-1">{pack.name}</h3>
                    <p className="text-xs text-slate-400 mb-2">{pack.description}</p>
                  </div>
                  {renderPackButton(pack)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex-shrink-0">
        <button
          onClick={handleBackClick}
          className="w-full px-6 py-4 text-2xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 transition-all duration-300 transform hover:scale-105"
        >
          BACK TO MENU
        </button>
      </div>
    </div>
  );
};

export default VibezScreen;