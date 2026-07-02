import React from 'react';
import { useRouteError, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  
  console.error(error);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: 'var(--color-bg-app)',
      padding: 'var(--space-6)',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: 'var(--color-danger-bg)',
        color: 'var(--color-danger)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-full)',
        marginBottom: 'var(--space-6)'
      }}>
        <AlertTriangle size={32} />
      </div>
      
      <h1 style={{ 
        fontSize: 'var(--font-size-2xl)', 
        fontWeight: 'var(--font-weight-semibold)',
        marginBottom: 'var(--space-3)'
      }}>
        Something went wrong
      </h1>
      
      <p style={{
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-8)',
        maxWidth: '400px'
      }}>
        An unexpected error occurred in the application. Please try reloading the page or return to the dashboard.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
        <Button onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
