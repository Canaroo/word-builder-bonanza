import React from 'react';

// The arcade-cabinet side art behind the start and menu screens (v7.90.0, the owner's ask: a lighter,
// 90s-arcade look). A violet sky with drifting stars, a striped sunset and a neon grid floor that
// scrolls toward you. It sits behind the screen's content (z-index -1 inside the app frame) and
// stops moving when the device asks for reduced motion. Original art, built from CSS.
const CabinetBackdrop: React.FC = () => (
  <div className="cabinet-backdrop" aria-hidden="true" data-testid="cabinet-backdrop">
    <div className="cab-stars cab-stars-far" />
    <div className="cab-stars cab-stars-near" />
    <div className="cab-sun" />
    <div className="cab-floor"><div className="cab-grid" /></div>
  </div>
);

export default CabinetBackdrop;
