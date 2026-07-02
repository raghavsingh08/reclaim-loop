import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminDashboard, listAllCases, getFacilities } from '../../services/admin';
import { getNotifications, markNotificationAsRead } from '../../services/notifications';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { Package, Activity, CheckCircle, Clock, DollarSign, AlertCircle, Building, Bell, Info, ArrowRight, User as UserIcon, Check } from 'lucide-react';
import './AdminDashboard.css';

function formatEventName(type) {
  if (!type) return 'Unknown Event';
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [allCases, setAllCases] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      getAdminDashboard(),
      listAllCases(),
      getFacilities(),
      getNotifications()
    ])
      .then(([dashboardData, casesData, facilitiesData, notificationsData]) => {
        setData(dashboardData);
        setAllCases(casesData?.cases || casesData || []);
        setFacilities(facilitiesData?.facilities || facilitiesData || []);
        setNotifications(notificationsData?.notifications || notificationsData || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingState text="Loading Operations Center..." />;
  if (error) return <EmptyState title="Failed to load" description={error} />;

  const pendingDecisionsCases = allCases.filter(c => c.status === 'DECISION_PENDING');
  const unreadNotifications = notifications.filter(n => !n.isRead).slice(0, 5); // top 5 unread

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>Operations Center</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          System-wide overview of recovery operations and logistics.
        </p>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard title="Total Cases" value={data.totalCases} icon={<Package size={18} />} />
        <MetricCard title="Active Cases" value={data.activeCases} icon={<Activity size={18} />} />
        <MetricCard title="Completed" value={data.completedCases} icon={<CheckCircle size={18} />} />
        <MetricCard title="Pending Decisions" value={data.pendingDecisions} icon={<AlertCircle size={18} color="var(--color-warning)" />} />
        <MetricCard title="Pending Refunds" value={data.refundPendingCases} icon={<Clock size={18} />} />
        <MetricCard title="Refund Obligations" value={`$${data.totalRefundObligations.toLocaleString()}`} icon={<DollarSign size={18} color="var(--color-danger)" />} />
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)' }}>
        
        {/* Left Column (Takes up more space natively if grid expands, but here it's auto-fit so it behaves responsively) */}
        <div className="admin-left-col">
          
          {/* Pending Decisions Panel */}
          <Card>
            <CardHeader title="Action Required: Pending Decisions" subtitle={`${pendingDecisionsCases.length} cases waiting for inspection outcome decision`} />
            <CardContent style={{ padding: 0 }}>
              {pendingDecisionsCases.length > 0 ? (
                <div className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: 'var(--space-3)' }}>Case Code</th>
                        <th style={{ padding: 'var(--space-3)' }}>Product</th>
                        <th style={{ padding: 'var(--space-3)' }}>Created</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingDecisionsCases.map(c => (
                        <tr key={c._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-weight-medium)' }}>{c.caseCode}</td>
                          <td style={{ padding: 'var(--space-3)' }}>{c.product?.name}</td>
                          <td style={{ padding: 'var(--space-3)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                            <Button variant="outline" size="sm" onClick={() => navigate(`/admin/cases/${c._id}`)}>Review</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={CheckCircle} title="All caught up" description="No pending decisions at this time." />
              )}
            </CardContent>
          </Card>

          {/* Live Recovery Cases Table */}
          <Card>
            <CardHeader title="Live Recovery Cases" action={<Button variant="ghost" onClick={() => navigate('/admin/cases')}>View All</Button>} />
            <CardContent style={{ padding: 0 }}>
              {data.recentCases?.length > 0 ? (
                <div className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: 'var(--space-3)' }}>Case Code</th>
                        <th style={{ padding: 'var(--space-3)' }}>Type</th>
                        <th style={{ padding: 'var(--space-3)' }}>Status</th>
                        <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentCases.map((rcase) => (
                        <tr key={rcase._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-weight-medium)' }}>{rcase.caseCode}</td>
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
                            <Button variant="ghost" onClick={() => navigate(`/admin/cases/${rcase._id}`)}>
                              <ArrowRight size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={Package} title="No cases yet" description="There are no active cases in the system." />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: '320px' }}>
          
          {/* Facility Summary Card */}
          <Card>
            <CardHeader title="Facility Operations" />
            <CardContent>
              {facilities.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {facilities.map(fac => {
                    const capacityTotal = fac.capacity?.total ?? 0;
                    const capacityReserved = fac.capacity?.reserved ?? 0;
                    const capacityAvailable = fac.capacity?.available ?? 0;
                    const currentLoad = fac.currentLoad ?? 0;
                    
                    const usage = capacityTotal > 0 ? Math.round((currentLoad / capacityTotal) * 100) : 0;
                    const isHighLoad = usage > 85;
                    return (
                      <div key={fac._id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                          <span style={{ fontWeight: 'var(--font-weight-medium)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Building size={14} /> {fac.name}
                          </span>
                          <span style={{ color: isHighLoad ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                            {usage}% usage · Capacity: {capacityTotal} total · {capacityReserved} reserved · {capacityAvailable} available
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${usage}%`, height: '100%', backgroundColor: isHighLoad ? 'var(--color-danger)' : 'var(--color-primary)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={Building} title="No facilities" description="No facilities configured." />
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Timeline */}
          <Card>
            <CardHeader title="Recent Activity" />
            <CardContent>
              {data.recentEvents?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '11px', top: '8px', bottom: '8px', width: '2px', backgroundColor: 'var(--color-border)', zIndex: 0 }} />
                  {data.recentEvents.slice(0, 5).map((event) => (
                    <div key={event._id} style={{ display: 'flex', gap: 'var(--space-4)', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-bg)', border: '2px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
                      </div>
                      <div style={{ paddingBottom: 'var(--space-2)' }}>
                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: '2px' }}>
                          {formatEventName(event.type)}
                        </h4>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><UserIcon size={12} /> {event.actorRole}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Info} title="No activity" description="No recent system events." />
              )}
            </CardContent>
          </Card>

          {/* Unread Notifications Panel */}
          <Card>
            <CardHeader title="Unread Alerts" />
            <CardContent>
              {unreadNotifications.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {unreadNotifications.map(notif => (
                    <div key={notif._id} style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-app)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ color: 'var(--color-primary)', flexShrink: 0 }}><Bell size={16} /></div>
                      <div style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}>
                        <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{notif.title}</div>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '2px' }}>{notif.message}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleMarkAsRead(notif._id)} style={{ padding: '4px' }}>
                        <Check size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Bell} title="All clear" description="No new alerts." />
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon }) {
  return (
    <Card>
      <CardContent style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>{title}</span>
          {icon}
        </div>
        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
