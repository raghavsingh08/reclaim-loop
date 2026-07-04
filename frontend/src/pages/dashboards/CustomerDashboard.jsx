import React, { useEffect, useState } from 'react';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useNavigate } from 'react-router-dom';
import { getCustomerDashboard } from '../../services/customer';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Package, Activity, CheckCircle, ArrowRight } from 'lucide-react';

export function CustomerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { isDesktop } = useResponsiveLayout();

  useEffect(() => {
    getCustomerDashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState text="Loading your dashboard..." />;
  if (error) return <ErrorState title="Failed to load" description={error} />;

  return (
    <div className="mobile-stack dashboard-content-wrapper">
      <div className="page-hero">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>Overview</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Manage and track your recovery cases.
          </p>
        </div>
        <div className="page-hero-actions"><Button onClick={() => navigate('/customer/cases/new')}>Create Case</Button></div></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard title="Total Cases" value={data.totalCases} icon={<Package size={20} />} />
        <MetricCard title="Active Cases" value={data.activeCases} icon={<Activity size={20} />} />
        <MetricCard title="Completed" value={data.completedCases} icon={<CheckCircle size={20} />} />
      </div>

      <Card>
        <CardHeader title="Recent Cases" action={
          <Button variant="outline" onClick={() => navigate('/customer/cases')} style={{ padding: 'var(--space-1) var(--space-3)' }}>
            View All
          </Button>
        } />
        <CardContent>
          {data.recentCases?.length > 0 ? (
            <>
              {isDesktop ? (
                <div className="table-responsive desktop-table-view">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: 'var(--space-3)' }}>Case Code</th>
                      <th style={{ padding: 'var(--space-3)' }}>Product</th>
                      <th style={{ padding: 'var(--space-3)' }}>Type</th>
                      <th style={{ padding: 'var(--space-3)' }}>Status</th>
                      <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentCases.map((rcase) => (
                      <tr key={rcase._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-weight-medium)' }}>{rcase.caseCode}</td>
                        <td style={{ padding: 'var(--space-3)' }}>{rcase.product?.name}</td>
                        <td style={{ padding: 'var(--space-3)' }}>{rcase.requestType}</td>
                        <td style={{ padding: 'var(--space-3)' }}>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            backgroundColor: 'var(--color-bg-secondary)', 
                            fontSize: '12px',
                            fontWeight: 'var(--font-weight-medium)'
                          }}>
                            <StatusBadge status={rcase.status} />
                          </span>
                        </td>
                        <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                          <Button variant="ghost" onClick={() => navigate(`/customer/cases/${rcase._id}`)}>
                            <ArrowRight size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              ) : (
              <div className="mobile-card-list">
                {data.recentCases.map((rcase) => (
                  <div 
                    key={rcase._id}
                    className="mobile-list-card"
                    onClick={() => navigate(`/customer/cases/${rcase._id}`)}
                  >
                    <div className="mobile-list-card-header">
                      <span className="mobile-case-code">{rcase.caseCode}</span>
                    </div>
                    <div className="mobile-list-card-body">
                      <div className="mobile-list-card-row">
                        <span className="mobile-list-card-label">Product</span>
                        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{rcase.product?.name}</span>
                      </div>
                      <div className="mobile-list-card-row">
                        <span className="mobile-list-card-label">Type</span>
                        <span>{rcase.requestType}</span>
                      </div>
                      <div className="mobile-list-card-row">
                        <span className="mobile-list-card-label">Status</span>
                        <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            backgroundColor: 'var(--color-bg-secondary)', 
                            fontSize: '12px',
                            fontWeight: 'var(--font-weight-medium)'
                          }}>
                            <StatusBadge status={rcase.status} />
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
              title="No recent cases" 
              description="You haven't created any recovery cases yet." 
              action={<Button onClick={() => navigate('/customer/cases/new')}>Create Case</Button>}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, icon }) {
  return (
    <Card>
      <CardContent className="metric-card-content">
        <div className="metric-card-header">
          <span className="metric-card-title">{title}</span>
          {icon}
        </div>
        <div className="metric-card-value">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
