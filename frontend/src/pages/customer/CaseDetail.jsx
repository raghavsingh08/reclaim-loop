import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { useParams, useNavigate } from 'react-router-dom';
import { getCaseById, getCaseTimeline } from '../../services/customer';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ArrowLeft, Clock, Info, User as UserIcon } from 'lucide-react';
import { useCaseRealtime } from '../../hooks/useCaseRealtime';

// Format technical event names (e.g. PICKUP_ASSIGNED -> Pickup Assigned)
function formatEventName(type) {
  if (!type) return 'Unknown Event';
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function CaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelinePageInfo, setTimelinePageInfo] = useState({ nextCursor: null, hasNextPage: false });
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timelineRequestGenerationRef = useRef(0);

  const loadData = useCallback((showLoading = false) => {
    if (showLoading) setLoading(true);
    const generation = ++timelineRequestGenerationRef.current;
    return Promise.all([
      getCaseById(caseId),
      getCaseTimeline(caseId),
    ])
      .then(([caseData, timelineData]) => {
        setData(caseData?.case || caseData?.recoveryCase || caseData);
        if (generation === timelineRequestGenerationRef.current) {
          setTimeline(timelineData?.events ?? []);
          setTimelinePageInfo(timelineData?.pageInfo ?? { nextCursor: null, hasNextPage: false });
        }
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  }, [caseId]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useCaseRealtime(caseId, loadData);

  const handleLoadMoreTimeline = async () => {
    if (!timelinePageInfo.hasNextPage || !timelinePageInfo.nextCursor || timelineLoadingMore) return;
    const generation = timelineRequestGenerationRef.current;
    setTimelineLoadingMore(true);
    try {
      const timelineData = await getCaseTimeline(caseId, { cursor: timelinePageInfo.nextCursor });
      if (generation !== timelineRequestGenerationRef.current) return;
      setTimeline((current) => {
        const existingIds = new Set(current.map(({ _id }) => _id));
        const nextEvents = (timelineData.events ?? []).filter(({ _id }) => !existingIds.has(_id));
        return [...current, ...nextEvents];
      });
      setTimelinePageInfo(timelineData.pageInfo ?? { nextCursor: null, hasNextPage: false });
    } catch (err) {
      setError(err.message || 'Failed to load timeline events');
    } finally {
      setTimelineLoadingMore(false);
    }
  };

  if (loading) return <LoadingState text="Loading case details..." />;
  if (error || !data) return <ErrorState title="Case not found" description={error || "Could not load the requested case."} action={<Button onClick={() => navigate('/customer/cases')}>Back to Cases</Button>} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Button variant="ghost" onClick={() => navigate('/customer/cases')} style={{ padding: 'var(--space-2)' }}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              Case {data.caseCode}
              <span style={{ 
                padding: '4px 10px', 
                borderRadius: '12px', 
                backgroundColor: 'var(--color-bg-secondary)', 
                fontSize: '12px',
                fontWeight: 'var(--font-weight-medium)'
              }}>
                <StatusBadge status={data.status} />
              </span>
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
              Created on {formatDate(data.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
        
        {/* Left Column: Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card>
            <CardHeader title="Request Information" />
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <DetailRow label="Type" value={data.requestType} />
              <DetailRow label="Reason" value={data.reason} />
              <DetailRow label="Description" value={data.description || 'No additional details provided.'} />
              <DetailRow label="Current Owner" value={data.currentOwnerType} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Product Details" />
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <DetailRow label="Product Name" value={data.product?.name} />
              <DetailRow label="Category" value={data.product?.category || '-'} />
              <DetailRow label="SKU" value={data.product?.sku || '-'} />
              <DetailRow label="Serial Number" value={data.product?.serialNumber || '-'} />
              <DetailRow label="Order ID" value={data.product?.orderId || '-'} />
              <DetailRow 
                label="Purchase Date" 
                value={data.product?.purchaseDate ? formatDate(data.product.purchaseDate) : '-'} 
              />
            </CardContent>
          </Card>

          {data.pickupAddress && (
            <Card>
              <CardHeader title="Pickup Address" />
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)' }}>
                  {data.pickupAddress.line1}
                </div>
                {data.pickupAddress.line2 && (
                  <div style={{ fontSize: 'var(--font-size-md)' }}>
                    {data.pickupAddress.line2}
                  </div>
                )}
                <div style={{ fontSize: 'var(--font-size-md)' }}>
                  {data.pickupAddress.city}, {data.pickupAddress.state} - {data.pickupAddress.pincode}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Timeline */}
        <Card>
          <CardHeader title="Case Timeline" />
          <CardContent>
            {timeline.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', position: 'relative' }}>
                {/* Vertical Line */}
                <div style={{
                  position: 'absolute',
                  left: '11px',
                  top: '8px',
                  bottom: '8px',
                  width: '2px',
                  backgroundColor: 'var(--color-border)',
                  zIndex: 0
                }} />

                {timeline.map((event, index) => (
                  <div key={event._id || index} style={{ display: 'flex', gap: 'var(--space-4)', position: 'relative', zIndex: 1 }}>
                    <div style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%', 
                      backgroundColor: 'var(--color-bg)', 
                      border: '2px solid var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
                    </div>
                    
                    <div style={{ paddingBottom: 'var(--space-4)' }}>
                      <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
                        {formatEventName(event.type)}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} />
                          {formatDateTime(event.createdAt)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <UserIcon size={14} />
                          {event.actorRole}
                        </span>
                      </div>
                      
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div style={{ 
                          backgroundColor: 'var(--color-bg-secondary)', 
                          padding: 'var(--space-2) var(--space-3)', 
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--font-size-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          {Object.entries(event.metadata).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', gap: '8px' }}>
                              <span style={{ color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{k}:</span>
                              <span>{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {timelinePageInfo.hasNextPage && (
                  <Button
                    variant="secondary"
                    onClick={handleLoadMoreTimeline}
                    disabled={timelineLoadingMore}
                    style={{ alignSelf: 'flex-start', marginLeft: '40px' }}
                  >
                    {timelineLoadingMore ? 'Loading...' : 'Load More'}
                  </Button>
                )}
              </div>
            ) : (
              <EmptyState icon={Info} title="No events" description="No timeline events recorded yet." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)' }}>{value}</span>
    </div>
  );
}
