import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg-app)'
    }}>
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page you are looking for doesn't exist or has been moved."
        action={
          <Button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        }
      />
    </div>
  );
}
