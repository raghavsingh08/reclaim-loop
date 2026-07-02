import React from 'react';
import './Button.css';

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  isLoading, 
  disabled, 
  icon: Icon,
  ...props 
}) {
  const baseClass = `btn btn-${variant} btn-${size} ${className}`;
  
  return (
    <button 
      className={baseClass.trim()} 
      disabled={disabled || isLoading} 
      {...props}
    >
      {isLoading ? (
        <span className="btn-spinner" />
      ) : Icon ? (
        <Icon className="btn-icon" size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : null}
      <span className="btn-content">{children}</span>
    </button>
  );
}
