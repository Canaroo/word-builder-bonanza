import React from 'react';

export type ArcadeButtonColor = 'yellow' | 'cyan' | 'pink' | 'green' | 'red' | 'purple' | 'slate';
type Size = 'sm' | 'md' | 'lg';

// Face colour and the darker "edge" shown beneath the button.
const COLORS: Record<ArcadeButtonColor, { face: string; edge: string }> = {
  yellow: { face: 'bg-gradient-to-b from-[#ffe27a] to-neon-yellow text-crt-900', edge: '#b7860b' },
  cyan: { face: 'bg-gradient-to-b from-[#7cf1ff] to-neon-cyan text-crt-900', edge: '#0b8fa3' },
  pink: { face: 'bg-gradient-to-b from-[#ff86c6] to-neon-pink text-white', edge: '#a3175f' },
  green: { face: 'bg-gradient-to-b from-[#8dffbc] to-neon-green text-crt-900', edge: '#13914a' },
  red: { face: 'bg-gradient-to-b from-[#ff8a95] to-neon-red text-white', edge: '#a3162a' },
  purple: { face: 'bg-gradient-to-b from-[#d39bff] to-neon-purple text-white', edge: '#6b21a8' },
  slate: { face: 'bg-gradient-to-b from-crt-600 to-crt-700 text-slate-100', edge: '#0c0a1d' },
};

// The three button tiers used across the game (v7.31):
//   solid (default): the one main action on a screen, a chunky arcade push button;
//   outline: other actions, in the same color family but quieter;
//   text: low-key links (Cancel, Not yet).
export type ArcadeButtonVariant = 'solid' | 'outline' | 'text';
// Full class strings (not built from parts) so Tailwind keeps them.
const OUTLINE: Record<ArcadeButtonColor, string> = {
  yellow: 'ring-neon-yellow/80 text-neon-yellow hover:bg-neon-yellow/10',
  cyan: 'ring-neon-cyan/80 text-neon-cyan hover:bg-neon-cyan/10',
  pink: 'ring-neon-pink/80 text-neon-pink hover:bg-neon-pink/10',
  green: 'ring-neon-green/80 text-neon-green hover:bg-neon-green/10',
  red: 'ring-neon-red/80 text-neon-red hover:bg-neon-red/10',
  purple: 'ring-neon-purple/80 text-neon-purple hover:bg-neon-purple/10',
  slate: 'ring-white/25 text-slate-200 hover:bg-white/5',
};
const TEXT: Record<ArcadeButtonColor, string> = {
  yellow: 'text-neon-yellow', cyan: 'text-neon-cyan', pink: 'text-neon-pink', green: 'text-neon-green',
  red: 'text-neon-red', purple: 'text-neon-purple', slate: 'text-slate-400',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-3 py-2.5 sm:py-3 text-sm min-[375px]:text-base sm:text-lg',
  lg: 'px-6 py-3.5 sm:py-4 text-xl sm:text-2xl',
};

interface ArcadeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ArcadeButtonColor;
  size?: Size;
  variant?: ArcadeButtonVariant;
}

/** Chunky arcade push button that presses down when tapped. */
const ArcadeButton = React.forwardRef<HTMLButtonElement, ArcadeButtonProps>(({ color = 'yellow', size = 'md', variant = 'solid', className = '', style, children, ...props }, ref) => {
  const { face, edge } = COLORS[color];
  if (variant !== 'solid') {
    const look = variant === 'outline'
      ? `rounded-xl ring-2 bg-crt-950/50 ${OUTLINE[color]} ${SIZES[size]} disabled:ring-white/10 disabled:text-slate-600`
      : `rounded-lg underline underline-offset-4 decoration-1 px-2 py-1 osd-text text-lg normal-case tracking-normal ${TEXT[color]} hover:brightness-125 disabled:text-slate-600`;
    return (
      <button
        ref={ref}
        type="button"
        {...props}
        style={style}
        className={`font-display uppercase tracking-wide flex items-center justify-center gap-2 select-none whitespace-nowrap transition-colors active:translate-y-px disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${look} ${className}`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      style={{ ['--btn-edge' as string]: edge, ...style }}
      className={`arcade-btn font-display uppercase tracking-wide rounded-xl flex items-center justify-center gap-2 select-none whitespace-nowrap disabled:cursor-not-allowed disabled:from-crt-700 disabled:to-crt-700 disabled:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-crt-900 ${face} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
});
ArcadeButton.displayName = 'ArcadeButton';

export default ArcadeButton;
