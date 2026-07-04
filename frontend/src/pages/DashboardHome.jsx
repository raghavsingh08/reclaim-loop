import React from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';

export function DashboardHome() {
  return (
    <div>
      <h1 style={{ 
        fontSize: 'var(--font-size-2xl)', 
        fontWeight: 'var(--font-weight-semibold)',
        marginBottom: 'var(--space-6)'
      }}>
        Overview
      </h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-6)' }}>
        <Card>
          <CardHeader title="Pending Inspections" subtitle="Awaiting review" />
          <CardContent>
            <div style={{ fontSize: '32px', fontWeight: 'var(--font-weight-bold)' }}>24</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader title="Active Repairs" subtitle="In progress" />
          <CardContent>
            <div style={{ fontSize: '32px', fontWeight: 'var(--font-weight-bold)' }}>12</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader title="Exchanges" subtitle="Processing" />
          <CardContent>
            <div style={{ fontSize: '32px', fontWeight: 'var(--font-weight-bold)' }}>8</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
