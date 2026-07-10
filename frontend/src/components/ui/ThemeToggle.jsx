import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function ThemeToggle({ style = {} }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-2)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-secondary)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color var(--transition-fast), color var(--transition-fast)',
        ...style
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)';
        e.currentTarget.style.color = 'var(--color-text-primary)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = 'var(--color-text-secondary)';
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary-light)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
