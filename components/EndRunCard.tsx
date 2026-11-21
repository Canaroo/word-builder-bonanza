import React, { useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { useArmDelay } from './useArmDelay';

/**
 * End a run for good (v7.67.5, the owner's ask): "I just want to be done with this run completely."
 * Two confirmations so it can't happen by accident. The second step swaps the buttons around and
 * its End button only wakes up after a moment, so a fast double tap can't fly through both.
 * The run is thrown away: nothing is saved or recorded (no score, no stats).
 */
export const END_RUN_SECOND_STEP_MS = 1000;

const SecondStep: React.FC<{ summary?: string; onCancel: () => void; onConfirm: () => void }> = ({ summary, onCancel, onConfirm }) => {
  const armed = useArmDelay(END_RUN_SECOND_STEP_MS);
  return (
    <>
      <p className="osd-text text-lg tracking-[0.25em] text-neon-red">ARE YOU SURE?</p>
      <h2 className="font-display text-2xl text-white leading-tight">GAME OVER, MAN. GAME OVER!</h2>
      <p className="text-slate-200 text-sm leading-snug">
        This can't be undone. The run{summary ? <> (<strong className="text-white">{summary}</strong>)</> : null} will be gone for good: no save, no score on the Top 50, no personal best.
      </p>
      <ArcadeButton color="green" className="w-full" onClick={onCancel}>No, keep my run</ArcadeButton>
      <ArcadeButton color="red" variant="outline" className="w-full" disabled={!armed} onClick={() => { if (armed) onConfirm(); }}>
        {armed ? '🗑️ Yes, end it for good' : 'Wait…'}
      </ArcadeButton>
    </>
  );
};

const EndRunCard: React.FC<{ summary?: string; onCancel: () => void; onConfirm: () => void }> = ({ summary, onCancel, onConfirm }) => {
  const [step, setStep] = useState<1 | 2>(1);
  return (
    <div className="absolute inset-0 z-[70] bg-crt-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="End this run?">
      <div className="bg-crt-900 border-4 border-neon-red rounded-2xl px-5 py-6 max-w-sm w-full flex flex-col items-center text-center gap-3 shadow-[0_0_28px_rgba(255,59,92,0.4)]">
        {step === 1 ? (
          <>
            <div className="text-5xl leading-none" aria-hidden="true">🗑️</div>
            <h2 className="font-display text-2xl text-neon-red leading-tight">END THIS RUN?</h2>
            <p className="text-slate-200 text-sm leading-snug">
              The run{summary ? <> (<strong className="text-white">{summary}</strong>)</> : null} won't be saved and its score won't count anywhere. You'll go back to the start screen.
            </p>
            <ArcadeButton color="red" className="w-full" onClick={() => setStep(2)}>End this run</ArcadeButton>
            <button type="button" className="osd-text text-lg text-slate-300 underline" onClick={onCancel}>Keep playing</button>
          </>
        ) : (
          <SecondStep summary={summary} onCancel={onCancel} onConfirm={onConfirm} />
        )}
      </div>
    </div>
  );
};

export default EndRunCard;
