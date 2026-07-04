import React, { useEffect, useState } from 'react';
import { getFacilities } from '../../services/admin';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '../../components/ui/States';
import { Building } from 'lucide-react';

export function AdminFacilities() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getFacilities()
      .then(data => setFacilities(data?.facilities || data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState text="Loading facilities..." />;
  if (error) return <ErrorState title="Failed to load facilities" description={error} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>Facilities</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          Manage sorting, processing, and recycling centers.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--space-4)' }}>
        {facilities.length > 0 ? (
          facilities.map((fac) => {
            const capacityTotal = fac.capacity?.total ?? 0;
            const capacityReserved = fac.capacity?.reserved ?? 0;
            const capacityAvailable = fac.capacity?.available ?? 0;
            const currentLoad = fac.currentLoad ?? 0;
            const usage = capacityTotal > 0 ? Math.round((currentLoad / capacityTotal) * 100) : 0;
            
            return (
              <Card key={fac._id}>
                <CardHeader 
                  title={fac.name} 
                  subtitle={`${fac.type} in ${fac.address?.city || 'Unknown City'} (${fac.address?.pincode || 'N/A'})`} 
                />
                <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Supported Categories</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(fac.supportedCategories || []).map(cat => (
                        <span key={cat} style={{
                          backgroundColor: 'var(--color-bg-secondary)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'var(--font-weight-medium)'
                        }}>
                          {cat}
                        </span>
                      ))}
                      {(!fac.supportedCategories || fac.supportedCategories.length === 0) && (
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>All</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                      <span style={{ fontWeight: 'var(--font-weight-medium)' }}>Capacity Usage</span>
                      <span style={{ color: usage > 85 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                        {usage}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${usage}%`, height: '100%', backgroundColor: usage > 85 ? 'var(--color-danger)' : 'var(--color-primary)' }} />
                    </div>
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr 1fr', 
                    gap: 'var(--space-2)', 
                    textAlign: 'center',
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-bg-app)',
                    borderRadius: 'var(--radius-md)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>{capacityTotal}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Total</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>{capacityReserved}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Reserved</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>{capacityAvailable}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Available</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div style={{ gridColumn: '1 / -1' }}>
            <EmptyState icon={Building} title="No facilities found" description="There are no active facilities in the system." />
          </div>
        )}
      </div>
    </div>
  );
}
