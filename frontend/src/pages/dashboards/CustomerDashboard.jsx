import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomerDashboard } from '../../services/customer';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { Package, Activity, CheckCircle, PlusCircle, ArrowRight } from 'lucide-react';

export function CustomerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getCustomerDashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState text="Loading your dashboard..." />;
  if (error) return <EmptyState title="Failed to load" description={error} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>Overview</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Manage and track your recovery cases.
          </p>
        </div>
        <Button onClick={() => navigate('/customer/cases/new')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <PlusCircle size={16} />
          Create Case
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
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
            <div className="table-responsive">
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
                          {rcase.status.replace(/_/g, ' ')}
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
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>{title}</span>
          {icon}
        </div>
        <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
