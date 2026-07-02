import React, { forwardRef } from 'react';
import './Input.css';

export const Input = forwardRef(({ className = '', label, error, icon: Icon, ...props }, ref) => {
  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <div className="input-container">
        {Icon && <Icon className="input-icon" size={16} />}
        <input 
          ref={ref}
          className={`input-field ${Icon ? 'has-icon' : ''} ${error ? 'is-invalid' : ''}`}
          {...props}
        />
      </div>
      {error && <span className="input-error">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';
