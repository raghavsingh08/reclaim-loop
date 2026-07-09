import React, { useEffect, useState, useCallback, useRef } from 'react';
import { formatDateTime, formatTime } from '../../utils/formatters';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ArrowLeft, Clock, User as UserIcon, CheckCircle, Package, Info } from 'lucide-react';
import { getPickupDetail, getPickupTimeline, acceptPickup, collectPickup, deliverPickup } from '../../services/courier';

function formatEventName(type) {
  if (!type) return 'Unknown Event';
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function CourierPickupDetail() {
  const { pickupId } = useParams();
  const navigate = useNavigate();

  const [pickup, setPickup] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelinePageInfo, setTimelinePageInfo] = useState({ nextCursor: null, hasNextPage: false });
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const timelineRequestGenerationRef = useRef(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const generation = ++timelineRequestGenerationRef.current;
      const data = await getPickupDetail(pickupId);
      setPickup(data);
      
      const actualCaseId = data?.caseId?._id || data?.caseId;
      if (actualCaseId) {
        const timelineData = await getPickupTimeline(actualCaseId);
        if (generation === timelineRequestGenerationRef.current) {
          setTimeline(timelineData.events ?? []);
          setTimelinePageInfo(timelineData.pageInfo ?? { nextCursor: null, hasNextPage: false });
        }
      } else if (generation === timelineRequestGenerationRef.current) {
        setTimeline([]);
        setTimelinePageInfo({ nextCursor: null, hasNextPage: false });
      }
    } catch (err) {
      setError('Pickup not found');
    } finally {
      setLoading(false);
    }
  }, [pickupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (actionFn, successMsg) => {
    setSuccessMessage(null);
    setActionLoading(true);
    try {
      await actionFn(pickupId);
      setSuccessMessage(successMsg);
      await loadData();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = () => handleAction(acceptPickup, 'Pickup accepted successfully!');
  const handleCollect = () => handleAction(collectPickup, 'Item collected successfully!');
  const handleDeliver = () => handleAction(
    (id) => deliverPickup(id, { scanCode: 'FACILITY-SCAN', note: 'Delivered to destination facility' }), 
    'Item delivered to facility successfully!'
  );

  const handleLoadMoreTimeline = async () => {
    if (!timelinePageInfo.hasNextPage || !timelinePageInfo.nextCursor || timelineLoadingMore) return;
    const actualCaseId = pickup?.caseId?._id || pickup?.caseId;
    if (!actualCaseId) return;
    const generation = timelineRequestGenerationRef.current;
    setTimelineLoadingMore(true);
    try {
      const timelineData = await getPickupTimeline(actualCaseId, { cursor: timelinePageInfo.nextCursor });
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

  if (loading && !pickup) return <LoadingState text="Loading pickup details..." />;
  if (error || !pickup) return <ErrorState title="Not Found" description={error || "Pickup not found."} />;

  const status = pickup.status;
  const caseData = pickup.caseData || {}; // from fallback
  const product = caseData.product || pickup.product || {}; 

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Button variant="ghost" onClick={() => navigate('/courier/dashboard')} style={{ padding: 'var(--space-2)' }}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            Pickup Details
            <span style={{ 
              padding: '4px 10px', 
              borderRadius: '12px', 
              backgroundColor: 'var(--color-bg-secondary)', 
              fontSize: '12px',
              fontWeight: 'var(--font-weight-medium)'
            }}>
              {status}
            </span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Scheduled: {formatDateTime(pickup.scheduledWindow?.start)} - {formatTime(pickup.scheduledWindow?.end)}
          </p>
        </div>
      </div>

      {successMessage && (
        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: '14px' }}>
          {successMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          <Card>
            <CardHeader title="Pickup From (Customer)" icon={<UserIcon size={18} />} />
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Address</span>
                <div style={{ fontSize: '14px', marginTop: '4px' }}>
                  <div>{pickup.pickupAddress?.line1}</div>
                  {pickup.pickupAddress?.line2 && <div>{pickup.pickupAddress.line2}</div>}
                  <div>{pickup.pickupAddress?.city}, {pickup.pickupAddress?.state} - {pickup.pickupAddress?.pincode}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {pickup.facility && (
            <Card>
              <CardHeader title="Deliver To (Facility)" icon={<Package size={18} />} />
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Destination</span>
                  <div style={{ fontSize: '14px', marginTop: '4px' }}>
                    <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{pickup.facility.name}</div>
                    <div>{pickup.facility.type.replace(/_/g, ' ')}</div>
                    <div>{pickup.facility.address?.city}, {pickup.facility.address?.state} - {pickup.facility.address?.pincode}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader title="Product Details" icon={<Package size={18} />} />
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Case Code</span>
                <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{caseData.caseCode || '-'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Request Type</span>
                <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{caseData.requestType || '-'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Product Name</span>
                <div>{product.name || '-'}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Case Status</span>
                <div>{caseData.status ? <StatusBadge status={caseData.status} /> : '-'}</div>
              </div>
            </CardContent>
          </Card>
          
        </div>

        {/* Right Column (Actions & Timeline) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          <Card style={{ border: status !== 'COLLECTED' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
            <CardHeader title="Action Panel" />
            <CardContent>
              {status === 'ASSIGNED' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    Review the details and accept this pickup task.
                  </p>
                  <Button onClick={handleAccept} disabled={actionLoading} style={{ width: '100%' }}>
                    {actionLoading ? 'Accepting...' : 'Accept Pickup'}
                  </Button>
                </div>
              )}
              {status === 'ACCEPTED' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    Once you receive the item from the customer, mark it as collected.
                  </p>
                  <Button 
                    onClick={handleCollect} 
                    disabled={actionLoading} 
                    style={{ width: '100%', backgroundColor: 'var(--color-success)', color: 'white' }}
                  >
                    {actionLoading ? 'Collecting...' : 'Collect Item'}
                  </Button>
                </div>
              )}
              {status === 'COLLECTED' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    Item collected. Please deliver it to the destination facility.
                  </p>
                  <Button 
                    onClick={handleDeliver} 
                    disabled={actionLoading} 
                    style={{ width: '100%', backgroundColor: 'var(--color-primary)', color: 'white' }}
                  >
                    {actionLoading ? 'Delivering...' : 'Deliver To Facility'}
                  </Button>
                </div>
              )}
              {status === 'DELIVERED_TO_FACILITY' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-4) 0' }}>
                  <CheckCircle size={32} color="var(--color-success)" />
                  <div style={{ fontWeight: 'var(--font-weight-medium)' }}>Delivered to Facility</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                    Waiting for facility receiver to confirm receipt.
                  </div>
                </div>
              )}
              {status === 'FAILED' && (
                <div style={{ textAlign: 'center', color: 'var(--color-danger)', fontWeight: 'var(--font-weight-medium)', padding: 'var(--space-4) 0' }}>
                  Pickup Failed
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Case Timeline" icon={<Clock size={18} />} />
            <CardContent>
              {timeline.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '11px', top: '8px', bottom: '8px', width: '2px', backgroundColor: 'var(--color-border)', zIndex: 0 }} />
                  {timeline.map((event, i) => (
                    <div key={event._id || i} style={{ display: 'flex', gap: 'var(--space-4)', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-bg)', border: '2px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
                      </div>
                      <div style={{ paddingBottom: 'var(--space-2)' }}>
                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: '2px' }}>
                          {formatEventName(event.type)}
                        </h4>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span>{formatDateTime(event.createdAt)}</span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><UserIcon size={12} /> {event.actorRole}</span>
                        </div>
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
    </div>
  );
}
