import React from 'react';
import { Loader2 } from 'lucide-react';
import './States.css';

export function LoadingState({ message = 'Loading...', fullScreen = false }) {
  return (
    <div className={`state-container ${fullScreen ? 'state-fullscreen' : ''}`}>
      <Loader2 className="state-spinner" size={32} />
      {message && <p className="state-message">{message}</p>}
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
