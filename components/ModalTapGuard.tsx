import React from 'react';
import { useArmDelay } from './useArmDelay';

/**
 * v7.59.0: every card that opens on its own (level-ups, Golden Round, the Fork, intros, secrets,
 * outcomes, offers...) ignores taps for a moment. Players are often still tapping tiles when a
 * card appears, and those taps used to hit Continue before the card could be read. A clear layer
 * sits over the card and swallows taps until a short bar has filled.
 * Cards the player opened on purpose (info, event log, activations) skip it; Last Words and
 * Phoenix Down have their own, longer guard.
 */
export const MODAL_ARM_MS = 1000;

/** Pop-up types that open without the player asking, and so get the guard. */
export const GUARDLESS_MODALS = new Set([
  'last-words', 'continue-offer', 'event-log', 'milestone-info', 'buff-info', 'powerplay-activation',
  'charm-activation', 'save-confirmation', 'gear',
  // The Triforce shelf opened from its chip (an assembled piece's card does get the guard: data.got).
]);

const ModalTapGuard: React.FC<{ ms?: number }> = ({ ms = MODAL_ARM_MS }) => {
  const armed = useArmDelay(ms);
  if (armed) return null;
  const swallow = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <div
      className="absolute inset-0 z-[65] flex items-end justify-center pb-6"
      data-testid="modal-tap-guard"
      onPointerDown={swallow} onPointerUp={swallow} onClick={swallow} onTouchStart={swallow}
    >
      <div className="w-40 flex flex-col items-center gap-1 pointer-events-none" aria-hidden="true">
        <span className="osd-text text-base leading-none text-neon-yellow/90 tracking-widest">READ ME</span>
        <div className="w-full h-1.5 rounded-full bg-crt-950/80 overflow-hidden ring-1 ring-neon-yellow/40">
          <div className="h-full bg-neon-yellow arm-fill" style={{ animationDuration: `${ms}ms` }} />
        </div>
      </div>
    </div>
  );
};

export default ModalTapGuard;
