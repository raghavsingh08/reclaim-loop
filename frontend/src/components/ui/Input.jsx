import React, { forwardRef, useId } from 'react';
import './Input.css';

export const Input = forwardRef(({ className = '', label, error, icon: Icon, id, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <div className="input-container">
        {Icon && <Icon className="input-icon" size={16} />}
        <input 
          id={inputId}
          ref={ref}
          className={`input-field ${Icon ? 'has-icon' : ''} ${error ? 'is-invalid' : ''}`}
          {...props}
        />
      </div>
      {error && <span className="input-error" role="alert">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';
