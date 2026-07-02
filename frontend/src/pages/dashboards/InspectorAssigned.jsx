import React from 'react';
import { EmptyState } from '../../components/ui/States';
import { ClipboardList } from 'lucide-react';

export function InspectorAssigned() {
  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', marginBottom: 'var(--space-4)' }}>Assigned Inspections</h1>
      <EmptyState 
        icon={ClipboardList} 
        title="Coming Soon" 
        description="The full list view of assigned inspections is under construction." 
      />
    </div>
  );
}
