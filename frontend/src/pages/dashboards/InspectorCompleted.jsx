import React from 'react';
import { EmptyState } from '../../components/ui/States';
import { CheckCircle } from 'lucide-react';

export function InspectorCompleted() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', marginBottom: 'var(--space-4)' }}>Completed Inspections</h1>
      <EmptyState 
        icon={CheckCircle} 
        title="Coming Soon" 
        description="The full list view of completed inspections is under construction." 
      />
    </div>
  );
}
