import React, { useEffect, useState } from 'react';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { formatDate } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';
import { listCases } from '../../services/customer';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ArrowRight, PackageOpen } from 'lucide-react';

export function CaseList() {
  const [cases, setCases] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { isDesktop } = useResponsiveLayout();

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
  if (error) return <ErrorState title="Failed to load cases" description={error} />;

  return (
    <div className="mobile-stack dashboard-content-wrapper">
      <div className="page-hero">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>My Cases</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            View and manage all your product recovery cases.
          </p>
        </div>
        <div className="page-hero-actions"><Button onClick={() => navigate('/customer/cases/new')}>Create Case</Button></div>
      </div>

      <Card>
        <CardContent style={{ padding: 0 }}>
          {cases && cases.length > 0 ? (
            <>
              {isDesktop ? (
                <div className="table-responsive desktop-table-view">
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
                        <td style={{ padding: 'var(--space-4)' }}>
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            backgroundColor: 'var(--color-bg-secondary)', 
                            fontSize: '12px',
                            fontWeight: 'var(--font-weight-medium)'
                          }}>
                            {c.requestType}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-4)' }}>{formatDate(c.createdAt)}</td>
                        <td style={{ padding: 'var(--space-4)' }}>
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            backgroundColor: 'var(--color-bg-secondary)', 
                            fontSize: '12px',
                            fontWeight: 'var(--font-weight-medium)'
                          }}>
                            <StatusBadge status={c.status} />
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
              <div className="mobile-card-list">
                {cases.map((c) => (
                  <div 
                    key={c._id}
                    className="mobile-list-card"
                    onClick={() => navigate(`/customer/cases/${c._id}`)}
                  >
                    <div className="mobile-list-card-header">
                      <span className="mobile-case-code">{c.caseCode}</span>
                      <span className="mobile-case-date">{formatDate(c.createdAt)}</span>
                    </div>
                    <div className="mobile-list-card-body">
                      <div className="mobile-list-card-row">
                        <span className="mobile-list-card-label">Product</span>
                        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{c.product?.name}</span>
                      </div>
                      <div className="mobile-list-card-row">
                        <span className="mobile-list-card-label">Type</span>
                        <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            backgroundColor: 'var(--color-bg-secondary)', 
                            fontSize: '12px',
                            fontWeight: 'var(--font-weight-medium)'
                          }}>
                            {c.requestType}
                          </span>
                      </div>
                      <div className="mobile-list-card-row">
                        <span className="mobile-list-card-label">Status</span>
                        <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            backgroundColor: 'var(--color-bg-secondary)', 
                            fontSize: '12px',
                            fontWeight: 'var(--font-weight-medium)'
                          }}>
                            <StatusBadge status={c.status} />
                          </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </>
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
