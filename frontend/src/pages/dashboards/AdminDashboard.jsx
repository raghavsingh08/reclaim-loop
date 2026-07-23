import React, { useCallback, useEffect, useState } from 'react';
import { formatDate, formatTime } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';
import { getAdminDashboard, getFacilities } from '../../services/admin';
import { markNotificationAsRead } from '../../services/notifications';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Package, Activity, CheckCircle, Clock, DollarSign, AlertCircle, Building, Bell, Info, ArrowRight, User as UserIcon, Check } from 'lucide-react';
import './AdminDashboard.css';
import { useDashboardRealtime } from '../../hooks/useDashboardRealtime';

import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

function formatEventName(type) {
  if (!type) return 'Unknown Event';
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { isDesktop } = useResponsiveLayout();
  const [data, setData] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [dashboardData, facilitiesData] = await Promise.all([
        getAdminDashboard(),
        getFacilities(),
      ]);
      setData(dashboardData);
      setFacilities(facilitiesData?.facilities || facilitiesData || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useDashboardRealtime(loadData);

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      await loadData();
    } catch (err) {
    }
  };

  if (loading) return <LoadingState text="Loading Operations Center..." />;
  if (error) return <ErrorState title="Failed to load" description={error} />;

  const unreadNotifications = data?.unreadNotificationsPreview ?? [];
  const unreadNotificationsCount = data?.unreadNotificationsCount ?? 0;

  // 5 Actionable Groups
  const needsPickupCases = data?.needsPickupCases ?? { items: [], totalCount: 0 };
  const needsFacilityReceiptCases = data?.needsFacilityReceiptCases ?? { items: [], totalCount: 0 };
  const needsInspectorCases = data?.needsInspectorCases ?? { items: [], totalCount: 0 };
  const pendingDecisionCases = data?.pendingDecisionCases ?? { items: [], totalCount: 0 };
  const pendingRefundCases = data?.pendingRefundCases ?? { items: [], totalCount: 0 };

  const totalActionableCount =
    (needsPickupCases.totalCount || 0) +
    (needsFacilityReceiptCases.totalCount || 0) +
    (needsInspectorCases.totalCount || 0) +
    (pendingDecisionCases.totalCount || 0) +
    (pendingRefundCases.totalCount || 0);

  // Active & Completed Cases
  const activeCasesData = data?.activeCases ?? {
    items: data?.recentCases ?? [],
    totalCount: data?.activeCases ?? 0,
  };
  const activeCasesItems = Array.isArray(activeCasesData) ? activeCasesData : (activeCasesData.items ?? []);
  const activeCasesTotal = typeof activeCasesData === 'number' ? activeCasesData : (activeCasesData.totalCount ?? activeCasesItems.length);

  const recentlyCompletedData = data?.recentlyCompletedCases ?? { items: [], totalCount: data?.completedCases ?? 0 };
  const recentlyCompletedItems = Array.isArray(recentlyCompletedData) ? recentlyCompletedData : (recentlyCompletedData.items ?? []);
  const recentlyCompletedTotal = typeof recentlyCompletedData === 'number' ? recentlyCompletedData : (recentlyCompletedData.totalCount ?? data?.completedCases ?? 0);

  const actionGroups = [
    {
      key: 'pendingRefunds',
      title: 'Pending Refunds',
      actionLabel: 'Process Refund',
      headerBg: 'var(--color-danger-bg)',
      badgeColor: 'var(--color-danger)',
      data: pendingRefundCases,
    },
    {
      key: 'pendingDecisions',
      title: 'Pending Decisions',
      actionLabel: 'Review Decision',
      headerBg: 'var(--color-warning-bg)',
      badgeColor: 'var(--color-warning)',
      data: pendingDecisionCases,
    },
    {
      key: 'needsInspector',
      title: 'Needs Inspector Assignment',
      actionLabel: 'Assign Inspector',
      headerBg: 'var(--color-purple-bg)',
      badgeColor: 'var(--color-purple)',
      data: needsInspectorCases,
    },
    {
      key: 'needsFacilityReceipt',
      title: 'Needs Facility Receipt',
      actionLabel: 'Receive Item',
      headerBg: 'var(--color-info-bg)',
      badgeColor: 'var(--color-info)',
      data: needsFacilityReceiptCases,
    },
    {
      key: 'needsPickup',
      title: 'Needs Pickup Assignment',
      actionLabel: 'Assign Pickup',
      headerBg: 'var(--color-primary-light)',
      badgeColor: 'var(--color-primary)',
      data: needsPickupCases,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>Operations Center</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          System-wide overview of recovery operations and logistics.
        </p>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 'var(--space-4)' }}>
        <MetricCard title="Total Cases" value={data.totalCases ?? 0} icon={<Package size={18} />} />
        <MetricCard title="Active Cases" value={activeCasesTotal} icon={<Activity size={18} />} />
        <MetricCard title="Completed" value={recentlyCompletedTotal} icon={<CheckCircle size={18} />} />
        <MetricCard title="Pending Decisions" value={data.pendingDecisions ?? pendingDecisionCases.totalCount} icon={<AlertCircle size={18} color="var(--color-warning)" />} />
        <MetricCard title="Pending Refunds" value={data.refundPendingCases ?? pendingRefundCases.totalCount} icon={<Clock size={18} />} />
        <MetricCard title="Refund Obligations" value={`$${(data.totalRefundObligations ?? 0).toLocaleString()}`} icon={<DollarSign size={18} color="var(--color-danger)" />} />
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 'var(--space-6)' }}>
        
        {/* Left Column */}
        <div className="admin-left-col" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          {/* Action Required Master Card */}
          <Card>
            <CardHeader 
              title="Action Required" 
              subtitle={totalActionableCount > 0 ? `${totalActionableCount} pending actions requiring admin intervention` : 'No pending actions'} 
            />
            <CardContent>
              {totalActionableCount > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {actionGroups.map(group => {
                    const items = group.data?.items ?? [];
                    const count = group.data?.totalCount ?? items.length;
                    if (count === 0 && items.length === 0) return null;

                    return (
                      <div 
                        key={group.key} 
                        style={{ 
                          border: '1px solid var(--color-border)', 
                          borderRadius: 'var(--radius-md)', 
                          overflow: 'hidden',
                          backgroundColor: 'var(--color-bg-surface)'
                        }}
                      >
                        <div style={{ 
                          padding: 'var(--space-3) var(--space-4)', 
                          backgroundColor: group.headerBg, 
                          display: 'flex', 
                          justify: 'space-between', 
                          alignItems: 'center',
                          borderBottom: '1px solid var(--color-border)'
                        }}>
                          <span style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                            {group.title} · {count}
                          </span>
                        </div>

                        {items.length > 0 ? (
                          isDesktop ? (
                            <div className="table-responsive">
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                                    <th style={{ padding: 'var(--space-3)' }}>Case Code</th>
                                    <th style={{ padding: 'var(--space-3)' }}>Product</th>
                                    <th style={{ padding: 'var(--space-3)' }}>Created</th>
                                    <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map(c => (
                                    <tr key={c._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                      <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-weight-medium)' }}>{c.caseCode}</td>
                                      <td style={{ padding: 'var(--space-3)' }}>{c.product?.name || '-'}</td>
                                      <td style={{ padding: 'var(--space-3)' }}>{formatDate(c.createdAt)}</td>
                                      <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/cases/${c._id}`)}>
                                          {group.actionLabel}
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="mobile-card-list" style={{ padding: 'var(--space-3)' }}>
                              {items.map(c => (
                                <div key={c._id} className="mobile-list-card" style={{ marginBottom: 'var(--space-2)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                                    <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{c.caseCode}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{formatDate(c.createdAt)}</span>
                                  </div>
                                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                                    {c.product?.name || '-'}
                                  </div>
                                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/cases/${c._id}`)} style={{ width: '100%' }}>
                                    {group.actionLabel}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={CheckCircle} title="All caught up" description="No pending actions required at this time." />
              )}
            </CardContent>
          </Card>

          {/* Active Recovery Cases Table */}
          <Card>
            <CardHeader 
              title="Active Recovery Cases" 
              subtitle={`${activeCasesTotal} total active cases`}
              action={<Button variant="ghost" onClick={() => navigate('/admin/cases')}>View All</Button>} 
            />
            <CardContent style={{ padding: 0 }}>
              {activeCasesItems.length > 0 ? (
                isDesktop ? (
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
                        {activeCasesItems.map((rcase) => (
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
                                <StatusBadge status={rcase.status} />
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
                  <div className="mobile-card-list" style={{ padding: 'var(--space-3)' }}>
                    {activeCasesItems.map((rcase) => (
                      <div key={rcase._id} className="mobile-list-card" style={{ marginBottom: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                          <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{rcase.caseCode}</span>
                          <StatusBadge status={rcase.status} />
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                          {rcase.product?.name || rcase.requestType}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/cases/${rcase._id}`)} style={{ width: '100%' }}>
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <EmptyState icon={Package} title="No active cases" description="There are currently no active recovery cases in the system." />
              )}
            </CardContent>
          </Card>

          {/* Recently Completed Cases Table */}
          <Card>
            <CardHeader 
              title="Recently Completed Cases" 
              subtitle={`${recentlyCompletedTotal} total completed cases`}
            />
            <CardContent style={{ padding: 0 }}>
              {recentlyCompletedItems.length > 0 ? (
                isDesktop ? (
                  <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                          <th style={{ padding: 'var(--space-3)' }}>Case Code</th>
                          <th style={{ padding: 'var(--space-3)' }}>Resolution / Type</th>
                          <th style={{ padding: 'var(--space-3)' }}>Completed Date</th>
                          <th style={{ padding: 'var(--space-3)', textAlign: 'right' }}>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentlyCompletedItems.map((ccase) => (
                          <tr key={ccase._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-weight-medium)' }}>{ccase.caseCode}</td>
                            <td style={{ padding: 'var(--space-3)' }}>{ccase.requestType}</td>
                            <td style={{ padding: 'var(--space-3)' }}>{formatDate(ccase.updatedAt || ccase.createdAt)}</td>
                            <td style={{ padding: 'var(--space-3)', textAlign: 'right' }}>
                              <Button variant="ghost" onClick={() => navigate(`/admin/cases/${ccase._id}`)}>
                                <ArrowRight size={16} />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mobile-card-list" style={{ padding: 'var(--space-3)' }}>
                    {recentlyCompletedItems.map((ccase) => (
                      <div key={ccase._id} className="mobile-list-card" style={{ marginBottom: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                          <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{ccase.caseCode}</span>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{formatDate(ccase.updatedAt || ccase.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                          {ccase.product?.name || ccase.requestType}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/cases/${ccase._id}`)} style={{ width: '100%' }}>
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <EmptyState icon={CheckCircle} title="No completed cases" description="No cases have been marked as completed yet." />
              )}
            </CardContent>
          </Card>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 'min(100%, 320px)' }}>
          
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
                          <span>{formatTime(event.createdAt)}</span>
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
            <CardHeader title="Unread Alerts" subtitle={`${unreadNotificationsCount} unread alerts`} />
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
