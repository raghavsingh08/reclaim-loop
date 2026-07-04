import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import './States.css';

export function LoadingState({ message, text, fullScreen = false }) {
  const displayMessage = message || text || 'Loading...';
  return (
    <div className={`state-container ${fullScreen ? 'state-fullscreen' : ''}`}>
      <Loader2 className="state-spinner" size={32} />
      {displayMessage && <p className="state-message">{displayMessage}</p>}
    </div>
  );
}

export function EmptyState({ 
  icon: Icon, 
  title = 'No data available', 
  description, 
  action 
}) {
  return (
    <div className="state-container">
      {Icon && (
        <div className="state-icon-wrapper">
          <Icon size={32} className="state-icon" />
        </div>
      )}
      <h3 className="state-title">{title}</h3>
      {description && <p className="state-description">{description}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Error', description, action }) {
  return (
    <div className="state-container">
      <div className="state-icon-wrapper" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
        <AlertTriangle size={32} className="state-icon" />
      </div>
      <h3 className="state-title">{title}</h3>
      {description && <p className="state-description">{description}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}
