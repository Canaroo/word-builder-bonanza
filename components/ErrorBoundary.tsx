import React from 'react';

interface ErrorBoundaryProps {
  /** Shown on the error screen's main button; returns the player to a safe screen. */
  onRecover: () => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const LAST_ERROR_KEY = 'wordNerdLastError';

/**
 * Catches a crash anywhere in a screen and shows a way out instead of a blank page.
 * The error is kept in localStorage (wordNerdLastError) so it can be reported.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Game screen crashed:', error, info.componentStack);
    try {
      localStorage.setItem(LAST_ERROR_KEY, JSON.stringify({
        at: new Date().toISOString(),
        version: __APP_VERSION__,
        message: String(error?.message ?? error),
        stack: String(error?.stack ?? '').slice(0, 2000),
      }));
    } catch { /* storage unavailable */ }
  }

  private recover = () => {
    this.setState({ error: null });
    this.props.onRecover();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
        <div className="text-6xl" aria-hidden="true">📼</div>
        <h1 className="font-display text-3xl neon-text-pink leading-tight">TRACKING ERROR</h1>
        <p className="text-slate-200 max-w-xs">
          The tape got chewed up. Something went wrong on our end, not yours. Your high scores and collection are safe.
        </p>
        <p className="osd-text text-base text-slate-500 break-words max-w-xs">ERR: {String(error.message || error).slice(0, 120)}</p>
        <button
          type="button"
          onClick={this.recover}
          className="arcade-btn font-display uppercase tracking-wide rounded-xl px-6 py-3 text-lg bg-gradient-to-b from-[#ffe17a] to-neon-yellow text-crt-900"
          style={{ ['--btn-edge' as string]: '#a8860f' }}
        >
          ⏏ Eject to Menu
        </button>
        <button type="button" onClick={() => location.reload()} className="osd-text text-lg text-neon-cyan underline">
          RELOAD THE GAME
        </button>
      </div>
    );
  }
}
