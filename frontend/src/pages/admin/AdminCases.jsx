import React, { useEffect, useState } from 'react';
import { listAllCases } from '../../services/admin';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { Package, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AdminCases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    listAllCases()
      .then(data => setCases(data?.cases || data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState text="Loading all cases..." />;
  if (error) return <EmptyState title="Failed to load cases" description={error} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>All Cases</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          Complete system view of all recovery operations.
        </p>
      </div>

      <Card>
        <CardContent style={{ padding: 0 }}>
          {cases.length > 0 ? (
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: 'var(--space-4)' }}>Case Code</th>
                    <th style={{ padding: 'var(--space-4)' }}>Product</th>
                    <th style={{ padding: 'var(--space-4)' }}>Type</th>
                    <th style={{ padding: 'var(--space-4)' }}>Customer ID</th>
                    <th style={{ padding: 'var(--space-4)' }}>Last Updated</th>
                    <th style={{ padding: 'var(--space-4)' }}>Status</th>
                    <th style={{ padding: 'var(--space-4)', textAlign: 'right' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr 
                      key={c._id} 
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-app)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => navigate(`/admin/cases/${c._id}`)}
                    >
                      <td style={{ padding: 'var(--space-4)', fontWeight: 'var(--font-weight-medium)' }}>{c.caseCode}</td>
                      <td style={{ padding: 'var(--space-4)' }}>{c.product?.name || '-'}</td>
                      <td style={{ padding: 'var(--space-4)' }}>{c.requestType}</td>
                      <td style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                        {String(c.customerId).substring(0, 8)}...
                      </td>
                      <td style={{ padding: 'var(--space-4)' }}>{new Date(c.updatedAt).toLocaleDateString()}</td>
                      <td style={{ padding: 'var(--space-4)' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          backgroundColor: 'var(--color-bg-secondary)', 
                          fontSize: '12px',
                          fontWeight: 'var(--font-weight-medium)'
                        }}>
                          {c.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                        <ArrowRight size={16} color="var(--color-text-secondary)" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState 
              icon={Package}
              title="No cases found" 
              description="There are no recovery cases in the system." 
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
