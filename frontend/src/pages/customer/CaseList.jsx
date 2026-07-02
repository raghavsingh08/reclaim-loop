import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCases } from '../../services/customer';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { PlusCircle, ArrowRight, PackageOpen } from 'lucide-react';

export function CaseList() {
  const [cases, setCases] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    listCases()
      .then((data) => {
        // Backend listCases returns { cases: [...] }
        setCases(data.cases || data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState text="Loading your cases..." />;
  if (error) return <EmptyState title="Failed to load cases" description={error} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>My Cases</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            View and manage all your product recovery cases.
          </p>
        </div>
        <Button onClick={() => navigate('/customer/cases/new')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <PlusCircle size={16} />
          Create Case
        </Button>
      </div>

      <Card>
        <CardContent style={{ padding: 0 }}>
          {cases && cases.length > 0 ? (
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: 'var(--space-4)' }}>Case Code</th>
                    <th style={{ padding: 'var(--space-4)' }}>Product</th>
                    <th style={{ padding: 'var(--space-4)' }}>Request Type</th>
                    <th style={{ padding: 'var(--space-4)' }}>Created Date</th>
                    <th style={{ padding: 'var(--space-4)' }}>Status</th>
                    <th style={{ padding: 'var(--space-4)', textAlign: 'right' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr 
                      key={c._id} 
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                      onClick={() => navigate(`/customer/cases/${c._id}`)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-app)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: 'var(--space-4)', fontWeight: 'var(--font-weight-medium)' }}>{c.caseCode}</td>
                      <td style={{ padding: 'var(--space-4)' }}>{c.product?.name}</td>
                      <td style={{ padding: 'var(--space-4)' }}>{c.requestType}</td>
                      <td style={{ padding: 'var(--space-4)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
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
              icon={PackageOpen}
              title="No cases found" 
              description="You haven't created any recovery cases yet." 
              action={<Button onClick={() => navigate('/customer/cases/new')}>Create your first case</Button>}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
