import React from 'react';
import './darklightmode.css';

// Dark mode is now handled directly in Userinfo.jsx via html class toggle
// This component is kept for backwards compatibility but simplified
const Darklightmode = ({ isDark, onToggle }) => {
  return (
    <button 
      className="wa-theme-toggle" 
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
};

export default Darklightmode;
