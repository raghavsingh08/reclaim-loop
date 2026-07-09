import React, { useEffect, useState, useCallback, useRef } from 'react';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ArrowLeft, Clock, Package, MapPin, ClipboardList, CheckCircle, Info } from 'lucide-react';
import { getCaseById, getCaseTimeline, receiveCase, startInspection, completeInspection, getCaseInspection } from '../../services/inspector';

function formatEventName(type) {
  if (!type) return 'Unknown Event';
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function InspectorCaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelinePageInfo, setTimelinePageInfo] = useState({ nextCursor: null, hasNextPage: false });
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
  const [inspection, setInspection] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form state for complete inspection
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [recommendedOutcome, setRecommendedOutcome] = useState('');
  const timelineRequestGenerationRef = useRef(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const generation = ++timelineRequestGenerationRef.current;
      const [cData, tData, inspData] = await Promise.all([
        getCaseById(caseId),
        getCaseTimeline(caseId).catch(() => ({ events: [], pageInfo: { nextCursor: null, hasNextPage: false } })),
        getCaseInspection(caseId).catch(() => null)
      ]);
      setCaseData(cData);
      if (generation === timelineRequestGenerationRef.current) {
        setTimeline(tData?.events ?? []);
        setTimelinePageInfo(tData?.pageInfo ?? { nextCursor: null, hasNextPage: false });
      }
      setInspection(inspData);
    } catch (err) {
      setError(err.message || 'Case not found');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleAction = async (actionFn, successMsg) => {
    setSuccessMessage(null);
    setActionLoading(true);
    try {
      await actionFn();
      setSuccessMessage(successMsg);
      await loadData();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceive = () => {
    const facilityId = caseData.assignedFacilityId || (caseData.assignedFacility ? caseData.assignedFacility._id : null);
    if (!facilityId) {
      alert('No facility assigned to this case.');
      return;
    }
    handleAction(() => receiveCase(facilityId, caseId), 'Item received successfully at facility!');
  };

  const handleStart = () => {
    handleAction(() => startInspection(caseId), 'Inspection started successfully!');
  };

  const handleComplete = (e) => {
    e.preventDefault();
    if (!condition || !recommendedOutcome) {
      alert('Condition and Recommended Outcome are required.');
      return;
    }
    handleAction(() => completeInspection(caseId, { condition, notes, recommendedOutcome }), 'Inspection completed successfully!');
  };

  if (loading && !caseData) return <LoadingState text="Loading case details..." />;
  if (error || !caseData) return <ErrorState title="Not Found" description={error || "Case not found."} />;

  const status = caseData.status;
  const product = caseData.product || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Button variant="ghost" onClick={() => navigate('/inspector/dashboard')} style={{ padding: 'var(--space-2)' }}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {caseData.caseCode}
            <span className={`status-chip status-${status.toLowerCase()}`} style={{ fontSize: '12px' }}>
              <StatusBadge status={status} />
            </span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)', display: 'flex', gap: '16px' }}>
            <span><strong>Type:</strong> {caseData.requestType}</span>
            <span><strong>Facility:</strong> {caseData.assignedFacility?.name || 'Pending'}</span>
            <span><strong>Assigned:</strong> {formatDate(caseData.updatedAt || caseData.createdAt)}</span>
          </p>
        </div>
      </div>

      {successMessage && (
        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} /> {successMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          <Card>
            <CardHeader title="Product Details" icon={<Package size={18} />} />
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Product Name</span>
                  <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{product.name || '-'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Category</span>
                  <div>{product.category || '-'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>SKU</span>
                  <div>{product.sku || '-'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Serial Number</span>
                  <div>{product.serialNumber || '-'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Purchase Date</span>
                  <div>{product.purchaseDate ? formatDate(product.purchaseDate) : '-'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Order ID</span>
                  <div>{product.orderId || '-'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Customer Pickup Address" icon={<MapPin size={18} />} />
            <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ fontSize: '14px' }}>
                {caseData.pickupAddress ? (
                  <>
                    <div>{caseData.pickupAddress.line1}</div>
                    {caseData.pickupAddress.line2 && <div>{caseData.pickupAddress.line2}</div>}
                    <div>{caseData.pickupAddress.city}, {caseData.pickupAddress.state} - {caseData.pickupAddress.pincode}</div>
                  </>
                ) : (
                  <span style={{ color: 'var(--color-text-secondary)' }}>No pickup address available.</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Inspection Timeline" icon={<Clock size={18} />} />
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
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{event.actorRole}</span>
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

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          <Card style={{ border: ['DELIVERED_TO_FACILITY', 'FACILITY_RECEIVED', 'INSPECTION_PENDING'].includes(status) ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
            <CardHeader title="Inspector Action Panel" icon={<ClipboardList size={18} />} />
            <CardContent>
              
              {status === 'DELIVERED_TO_FACILITY' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    Courier has delivered this item. Please receive it at the facility.
                  </p>
                  <Button onClick={handleReceive} disabled={actionLoading} style={{ width: '100%', marginTop: '8px' }}>
                    {actionLoading ? 'Receiving...' : 'Receive Item'}
                  </Button>
                </div>
              )}

              {status === 'FACILITY_RECEIVED' && (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px', textAlign: 'center', padding: 'var(--space-4) 0' }}>
                  Waiting for admin to assign an inspector.
                </div>
              )}

              {status === 'INSPECTION_ASSIGNED' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    You have been assigned to evaluate this item.
                  </p>
                  <Button onClick={handleStart} disabled={actionLoading} style={{ width: '100%', marginTop: '8px' }}>
                    {actionLoading ? 'Starting...' : 'Start Inspection'}
                  </Button>
                </div>
              )}

              {status === 'INSPECTION_PENDING' && (
                <form onSubmit={handleComplete} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  
                  <div className="form-group">
                    <label className="form-label">Condition <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <select 
                      className="form-input" 
                      value={condition} 
                      onChange={e => setCondition(e.target.value)}
                      required
                    >
                      <option value="">Select Condition...</option>
                      <option value="NEW">NEW</option>
                      <option value="GOOD">GOOD</option>
                      <option value="DAMAGED">DAMAGED</option>
                      <option value="UNUSABLE">UNUSABLE</option>
                      <option value="MISSING_PARTS">MISSING_PARTS</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Recommendation <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <select 
                      className="form-input" 
                      value={recommendedOutcome} 
                      onChange={e => setRecommendedOutcome(e.target.value)}
                      required
                    >
                      <option value="">Select Outcome...</option>
                      <option value="REFUND">REFUND</option>
                      <option value="REPAIR">REPAIR</option>
                      <option value="EXCHANGE">EXCHANGE</option>
                      <option value="RECYCLE">RECYCLE</option>
                      <option value="REJECT">REJECT</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Inspection Notes</label>
                    <textarea 
                      className="form-input" 
                      placeholder="Enter detailed observations..."
                      rows={4}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group" style={{ padding: '24px', border: '2px dashed var(--color-border)', borderRadius: '8px', textAlign: 'center', backgroundColor: 'var(--color-bg-app)' }}>
                     <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Drop images here or click to upload<br/>(Placeholder for image upload)</span>
                  </div>

                  <Button type="submit" disabled={actionLoading} style={{ width: '100%', marginTop: '8px', backgroundColor: 'var(--color-primary)', color: 'white' }}>
                    {actionLoading ? 'Submitting...' : 'Complete Inspection'}
                  </Button>
                </form>
              )}

              {['INSPECTION_COMPLETED', 'DECISION_PENDING', 'REFUND_PENDING', 'REFUND_APPROVED', 'CASE_COMPLETED'].includes(status) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', marginBottom: '8px' }}>
                    <CheckCircle size={20} />
                    <span style={{ fontWeight: 'var(--font-weight-medium)' }}>Inspection Completed</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Condition</span>
                      <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{inspection?.condition || caseData.inspectionDetails?.condition || (inspection ? '' : 'N/A')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Recommendation</span>
                      <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{inspection?.recommendedOutcome || caseData.inspectionDetails?.recommendedOutcome || (inspection ? '' : 'N/A')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Completed Time</span>
                      <span>{inspection?.updatedAt || inspection?.completedAt ? formatDateTime(inspection.updatedAt || inspection.completedAt) : (caseData.inspectionDetails?.completedAt ? formatDateTime(caseData.inspectionDetails.completedAt) : (inspection ? '' : '-'))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Inspector Name</span>
                      <span>{inspection?.inspectorId?.name || inspection?.inspectorId?.email || caseData.assignedInspector?.name || caseData.assignedInspector?.email || (inspection ? '' : '-')}</span>
                    </div>
                  </div>
                  
                  {(inspection?.notes || caseData.inspectionDetails?.notes) && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Inspection Notes</span>
                      <p style={{ fontSize: '14px', backgroundColor: 'var(--color-bg-app)', padding: '12px', borderRadius: '4px', marginTop: '4px' }}>
                        {inspection?.notes || caseData.inspectionDetails?.notes}
                      </p>
                    </div>
                  )}

                  {inspection?.images && inspection.images.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Attached Evidence</span>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        {inspection.images.map((img, idx) => (
                          <img key={idx} src={img} alt="Evidence" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!['DELIVERED_TO_FACILITY', 'FACILITY_RECEIVED', 'INSPECTION_ASSIGNED', 'INSPECTION_PENDING', 'INSPECTION_COMPLETED', 'DECISION_PENDING', 'REFUND_PENDING', 'REFUND_APPROVED', 'CASE_COMPLETED'].includes(status) && (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px', textAlign: 'center', padding: 'var(--space-4) 0' }}>
                  No inspector actions available at this stage.
                </div>
              )}

            </CardContent>
          </Card>



        </div>
      </div>
    </div>
  );
}
