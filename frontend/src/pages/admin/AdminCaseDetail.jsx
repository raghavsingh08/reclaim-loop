import React, { useEffect, useState, useCallback, useRef } from 'react';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState, ErrorState } from '../../components/ui/States';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { 
  Package, 
  User as UserIcon,
  Clock,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Info,
  ClipboardList
} from 'lucide-react';
import { getCaseById, getCaseTimeline, getCaseDecisions, getCaseRefunds, getFacilities, startReview, makeDecision, approveRefund, recordRefund, assignPickup, getInspectors, assignInspector, getCaseInspection, receiveAtFacility } from '../../services/admin';
import { generateIdempotencyKey } from '../../utils/idempotency';
import './AdminCaseDetail.css';
import { useCaseRealtime } from '../../hooks/useCaseRealtime';

function formatEventName(type) {
  if (!type) return 'Unknown';
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function AdminCaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  
  const [caseData, setCaseData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelinePageInfo, setTimelinePageInfo] = useState({ nextCursor: null, hasNextPage: false });
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
  const [decisions, setDecisions] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [inspectors, setInspectors] = useState([]);
  const [inspection, setInspection] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Forms state
  const [decisionForm, setDecisionForm] = useState({ decision: 'APPROVE_REFUND', reason: '', notes: '' });
  const [approveRefundForm, setApproveRefundForm] = useState({ amount: '', currency: 'INR', reason: '', notes: '' });
  const [recordRefundForm, setRecordRefundForm] = useState({ referenceNumber: '', debitAccount: 'Refund Account', creditAccount: 'Customer Bank', notes: '' });
  const [receiveFacilityId, setReceiveFacilityId] = useState('');
  const [assignInspectorId, setAssignInspectorId] = useState('');
  
  const [assignPickupForm, setAssignPickupForm] = useState({
    courierId: '',
    facilityId: '',
    start: '', end: ''
  });
  const timelineRequestGenerationRef = useRef(0);
  const loadDataPromiseRef = useRef(null);
  const lastLoadCompletedAtRef = useRef(0);
  const actionInFlightRef = useRef(false);

  const loadData = useCallback(async ({ force = false } = {}) => {
    if (loadDataPromiseRef.current) return loadDataPromiseRef.current;
    if (!force && Date.now() - lastLoadCompletedAtRef.current < 500) return undefined;

    const loadPromise = (async () => {
      try {
        setLoading(true);
        const generation = ++timelineRequestGenerationRef.current;
        
        const cData = await getCaseById(caseId);
        const skipInspection = [
          'CASE_CREATED', 'PICKUP_ASSIGNED', 'PICKUP_ACCEPTED', 
          'ITEM_COLLECTED', 'DELIVERED_TO_FACILITY', 'FACILITY_RECEIVED'
        ].includes(cData.status);
        const shouldFetchFacilities = ['CASE_CREATED', 'ITEM_COLLECTED', 'IN_TRANSIT'].includes(cData.status);
        const shouldFetchInspectors = cData.status === 'FACILITY_RECEIVED';

        const [tData, dData, rData, fData, iData, inspData] = await Promise.all([
          getCaseTimeline(caseId),
          getCaseDecisions(caseId),
          getCaseRefunds(caseId),
          shouldFetchFacilities ? getFacilities().catch(() => []) : Promise.resolve([]),
          shouldFetchInspectors ? getInspectors().catch(() => []) : Promise.resolve([]),
          skipInspection ? Promise.resolve(null) : getCaseInspection(caseId).catch(() => null)
        ]);
        setCaseData(cData);
        if (generation === timelineRequestGenerationRef.current) {
          setTimeline(tData?.events ?? []);
          setTimelinePageInfo(tData?.pageInfo ?? { nextCursor: null, hasNextPage: false });
        }
        setDecisions(dData?.length ? dData : []);
        setRefunds(rData?.length ? rData : []);
        setFacilities(fData?.facilities || fData || []);
        setInspectors(iData || []);
        setInspection(inspData);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load case details');
      } finally {
        lastLoadCompletedAtRef.current = Date.now();
        loadDataPromiseRef.current = null;
        setLoading(false);
      }
    })();

    loadDataPromiseRef.current = loadPromise;
    return loadPromise;
  }, [caseId]);

  useEffect(() => {
    loadData();
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
      setActionError(err.message || 'Failed to load timeline events');
    } finally {
      setTimelineLoadingMore(false);
    }
  };

  const handleAction = async (actionFn, payload = null) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setActionError(null);
    setSuccessMessage(null);
    setActionLoading(true);
    try {
      if (actionFn === assignPickup) {
        await actionFn(payload);
      } else {
        await actionFn(caseId, payload);
      }
      setSuccessMessage('Action completed successfully.');
      await loadData({ force: true });
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'IDEMPOTENCY_IN_PROGRESS') {
        setActionError('This action is currently in progress. Please wait.');
      } else if (code === 'IDEMPOTENCY_KEY_REUSED') {
        setActionError('This action has already been completed.');
      } else {
        setActionError(err.response?.data?.message || err.message || 'Action failed');
      }
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(false);
    }
  };

  const handleAssignPickup = (e) => {
    e.preventDefault();
    const payload = {
      caseId,
      courierId: assignPickupForm.courierId,
      facilityId: assignPickupForm.facilityId,
      scheduledWindow: {
        start: assignPickupForm.start,
        end: assignPickupForm.end
      }
    };
    const key = generateIdempotencyKey();
    handleAction(() => assignPickup(payload, key));
  };

  const handleStartReview = () => handleAction(startReview);
  
  const handleDecide = (e) => {
    e.preventDefault();
    handleAction(makeDecision, decisionForm);
  };
  
  const handleApproveRefund = (e) => {
    e.preventDefault();
    handleAction(approveRefund, { ...approveRefundForm, amount: Number(approveRefundForm.amount) });
  };
  
  const handleRecordRefund = (e) => {
    e.preventDefault();
    handleAction(recordRefund, { ...recordRefundForm });
  };

  const handleReceiveAtFacility = (e) => {
    e.preventDefault();
    if (!receiveFacilityId) return;
    handleAction(() => receiveAtFacility(receiveFacilityId, caseId));
  };

  const handleAssignInspector = (e) => {
    e.preventDefault();
    if (!assignInspectorId) return;
    const key = generateIdempotencyKey();
    handleAction(() => assignInspector(caseId, assignInspectorId, key));
  };



  if (loading && !caseData) return <LoadingState text="Loading case details..." />;
  if (error) return <ErrorState title="Error" description={error} />;
  if (!caseData) return <EmptyState title="Not Found" description="Case not found" />;

  const status = caseData.status;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <Button variant="ghost" onClick={() => navigate('/admin/cases')} style={{ padding: '4px' }}>
              <ArrowLeft size={20} />
            </Button>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {caseData.caseCode}
              <span style={{ 
                padding: '4px 12px', 
                borderRadius: '16px', 
                backgroundColor: 'var(--color-bg-secondary)', 
                fontSize: '14px',
                fontWeight: 'var(--font-weight-medium)',
                letterSpacing: '0.5px'
              }}>
                <StatusBadge status={status} />
              </span>
            </h1>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', marginLeft: '44px' }}>
            {caseData.requestType} • Created {formatDate(caseData.createdAt)}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="admin-detail-grid">
        
        {/* Left Column (Data) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-6)' }}>
            {/* Product Details */}
            <Card>
              <CardHeader title="Product Information" icon={<Package size={18} />} />
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Name</div>
                  <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{caseData.product?.name}</div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Category</div>
                    <div>{caseData.product?.category || '-'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Condition</div>
                    <div>{caseData.product?.condition || '-'}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Customer Reason</div>
                  <div style={{ backgroundColor: 'var(--color-bg-app)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginTop: '4px', fontSize: '14px' }}>
                    {caseData.reason}
                    {caseData.description && <div style={{ marginTop: '8px', color: 'var(--color-text-secondary)' }}>{caseData.description}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Details */}
            <Card>
              <CardHeader title="Customer Details" icon={<UserIcon size={18} />} />
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Customer ID</div>
                  <div style={{ fontWeight: 'var(--font-weight-medium)', fontFamily: 'monospace' }}>{caseData.customerId}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Current Owner ID</div>
                  <div style={{ fontFamily: 'monospace' }}>{caseData.currentOwnerId}</div>
                </div>

                {caseData.pickupAddress && (
                  <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Pickup Address</div>
                    <div style={{ fontSize: '14px' }}>
                      <div>{caseData.pickupAddress.line1}</div>
                      {caseData.pickupAddress.line2 && <div>{caseData.pickupAddress.line2}</div>}
                      <div>{caseData.pickupAddress.city}, {caseData.pickupAddress.state} - {caseData.pickupAddress.pincode}</div>
                    </div>
                  </div>
                )}
                
                {caseData.assignedInspector && (
                  <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Assigned Inspector</div>
                    <div style={{ fontSize: '14px' }}>
                      <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{caseData.assignedInspector.name || 'Unknown'}</div>
                      <div style={{ color: 'var(--color-text-secondary)' }}>{caseData.assignedInspector.email}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Inspection Results Card */}
          {(inspection || ['INSPECTION_COMPLETED', 'DECISION_PENDING', 'REFUND_PENDING', 'REFUND_APPROVED', 'CASE_COMPLETED'].includes(status)) && (
            <Card>
              <CardHeader title="Inspection Results" icon={<ClipboardList size={18} />} />
              <CardContent>
                {inspection ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 'var(--space-4)' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Condition</span>
                        <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{inspection.condition || '-'}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Recommended Outcome</span>
                        <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{inspection.recommendedOutcome || '-'}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Completed Time</span>
                        <div>{inspection.status === 'COMPLETED' ? formatDateTime(inspection.updatedAt) : '-'}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Inspector Name</span>
                        <div>{inspection.inspectorId?.name || inspection.inspectorId?.email || '-'}</div>
                      </div>
                    </div>
                    {inspection.notes && (
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Inspector Notes</span>
                        <div style={{ backgroundColor: 'var(--color-bg-app)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginTop: '4px', fontSize: '14px' }}>
                          {inspection.notes}
                        </div>
                      </div>
                    )}
                    {inspection.images && inspection.images.length > 0 && (
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Attached Evidence</span>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: '4px' }}>
                          {inspection.images.map((img, idx) => (
                            <img key={idx} src={img} alt="Evidence" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px' }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState icon={ClipboardList} title="No Inspection" description="No inspection records found." />
                )}
              </CardContent>
            </Card>
          )}

          {/* Decisions Card */}
          {decisions.length > 0 && (
            <Card>
              <CardHeader title="Decision History" icon={<CheckCircle size={18} />} />
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {decisions.map(d => (
                  <div key={d._id} style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-app)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{d.decision.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{formatDateTime(d.createdAt)}</span>
                    </div>
                    {d.reason && <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong>Reason:</strong> {d.reason}</div>}
                    {(d.notes || d.comments) && <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}><strong>Internal Notes:</strong> {d.notes || d.comments}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Refunds Card */}
          {refunds.length > 0 && (
            <Card>
              <CardHeader title="Refund History" icon={<DollarSign size={18} />} />
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {refunds.map((r, i) => (
                  <div key={r._id || i} style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-app)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{r.currency || 'INR'} {r.amount?.toLocaleString()}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', padding: '2px 6px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '10px' }}>
                         {r.status || 'PROCESSED'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                      {r.approvedBy && <div><strong>Approved By:</strong> {r.approvedBy?.name || r.approvedBy}</div>}
                      {r.referenceNumber && <div><strong>Reference:</strong> {r.referenceNumber}</div>}
                      {r.approvedAt && <div><strong>Approved Time:</strong> {formatDateTime(r.approvedAt)}</div>}
                      {r.recordedAt && <div><strong>Recorded Time:</strong> {formatDateTime(r.recordedAt)}</div>}
                      {r.createdAt && !r.approvedAt && !r.recordedAt && <div><strong>Time:</strong> {formatDateTime(r.createdAt)}</div>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Timeline Card */}
          <Card>
            <CardHeader title="Audit Timeline" icon={<Clock size={18} />} />
            <CardContent>
              {timeline.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '11px', top: '8px', bottom: '8px', width: '2px', backgroundColor: 'var(--color-border)', zIndex: 0 }} />
                  {timeline.map((event) => (
                    <div key={event._id} style={{ display: 'flex', gap: 'var(--space-4)', position: 'relative', zIndex: 1 }}>
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

        {/* Right Column (Actions) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 'min(100%, 320px)' }}>
          
          <Card style={{ border: '2px solid var(--color-primary)' }}>
            <CardHeader title="Admin Actions" icon={<AlertCircle size={18} color="var(--color-primary)" />} />
            <CardContent>
              
              {successMessage && (
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: '14px' }}>
                  {successMessage}
                </div>
              )}
              {actionError && (
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: '14px' }}>
                  {actionError}
                </div>
              )}

              {status === 'CASE_CREATED' && (
                <form onSubmit={handleAssignPickup} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Assign a courier and destination facility for this pickup.
                  </p>
                  
                  <Input 
                    label="Courier ID" 
                    value={assignPickupForm.courierId} 
                    onChange={e => setAssignPickupForm({ ...assignPickupForm, courierId: e.target.value })} 
                    placeholder="Enter valid Courier user ID"
                    required 
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'var(--font-weight-medium)' }}>Destination Facility</label>
                    <select 
                      value={assignPickupForm.facilityId} 
                      onChange={e => setAssignPickupForm({ ...assignPickupForm, facilityId: e.target.value })}
                      required
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-app)',
                        fontSize: 'var(--font-size-md)',
                        color: 'var(--color-text)'
                      }}
                    >
                      <option value="" disabled>Select a facility...</option>
                      {facilities.map(f => (
                        <option key={f._id} value={f._id}>
                          {f.name} ({f.type.replace(/_/g, ' ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 'var(--font-weight-medium)', marginTop: 'var(--space-2)' }}>Scheduled Window</div>
                  <Input 
                    label="Start Time" 
                    type="datetime-local"
                    value={assignPickupForm.start} 
                    onChange={e => setAssignPickupForm({ ...assignPickupForm, start: e.target.value })} 
                    required 
                  />
                  <Input 
                    label="End Time" 
                    type="datetime-local"
                    value={assignPickupForm.end} 
                    onChange={e => setAssignPickupForm({ ...assignPickupForm, end: e.target.value })} 
                    required 
                  />

                  <Button type="submit" disabled={actionLoading} style={{ width: '100%', marginTop: 'var(--space-2)' }}>
                    {actionLoading ? 'Assigning...' : 'Assign Pickup'}
                  </Button>
                </form>
              )}

              {(status === 'ITEM_COLLECTED' || status === 'IN_TRANSIT') && (
                <form onSubmit={handleReceiveAtFacility} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Receive this item at a facility to begin the inspection process.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'var(--font-weight-medium)' }}>Select Facility</label>
                    <select 
                      value={receiveFacilityId} 
                      onChange={e => setReceiveFacilityId(e.target.value)}
                      required
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-app)',
                        fontSize: 'var(--font-size-md)',
                        color: 'var(--color-text)'
                      }}
                    >
                      <option value="" disabled>Select a facility...</option>
                      {facilities.map(f => (
                        <option key={f._id} value={f._id}>
                          {f.name} ({f.type.replace(/_/g, ' ')}) - {f.address?.city}, {f.address?.pincode} - {f.capacity?.available} space left
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" disabled={actionLoading} style={{ width: '100%' }}>
                    {actionLoading ? 'Receiving...' : 'Receive at Facility'}
                  </Button>
                </form>
              )}

              {status === 'FACILITY_RECEIVED' && (
                <form onSubmit={handleAssignInspector} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Assign an inspector to perform the physical evaluation.
                  </p>
                  
                  {inspectors.length > 0 ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'var(--font-weight-medium)' }}>Select Inspector</label>
                        <select 
                          value={assignInspectorId} 
                          onChange={e => setAssignInspectorId(e.target.value)}
                          required
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-app)',
                            fontSize: 'var(--font-size-md)',
                            color: 'var(--color-text)'
                          }}
                        >
                          <option value="" disabled>Select an inspector...</option>
                          {inspectors.map(i => (
                            <option key={i._id} value={i._id}>
                              {i.name || i.email}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button type="submit" disabled={actionLoading} style={{ width: '100%' }}>
                        {actionLoading ? 'Assigning...' : 'Assign Inspector'}
                      </Button>
                    </>
                  ) : (
                    <EmptyState 
                      icon={AlertCircle} 
                      title="No inspectors available" 
                      description="There are currently no active inspector accounts in the system." 
                    />
                  )}
                </form>
              )}

              {(status === 'INSPECTION_COMPLETED' || status === 'DECISION_PENDING') && (
                <div style={{ marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)' }}>Inspector Recommendation</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Condition</span>
                      <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{inspection?.condition || caseData.inspectionDetails?.condition || '-'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Recommendation</span>
                      <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{inspection?.recommendedOutcome || caseData.inspectionDetails?.recommendedOutcome || '-'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>Completed</span>
                      <span>{caseData.inspectionDetails?.completedAt ? formatDateTime(caseData.inspectionDetails.completedAt) : '-'}</span>
                    </div>
                    {(inspection?.notes || caseData.inspectionDetails?.notes) && (
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Inspector Notes</span>
                        <div style={{ backgroundColor: 'var(--color-bg-app)', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                          {inspection?.notes || caseData.inspectionDetails?.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {status === 'INSPECTION_COMPLETED' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    Start the administrative review process to make a final decision.
                  </p>
                  <Button onClick={handleStartReview} disabled={actionLoading} style={{ width: '100%' }}>
                    {actionLoading ? 'Starting...' : 'Start Review'}
                  </Button>
                </div>
              )}

              {status === 'DECISION_PENDING' && (
                <form onSubmit={handleDecide} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Review inspection results and make a final decision.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'var(--font-weight-medium)' }}>Decision Outcome</label>
                    <select 
                      value={decisionForm.decision ?? ''} 
                      onChange={e => setDecisionForm({ ...decisionForm, decision: e.target.value })}
                      required
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-app)',
                        fontSize: 'var(--font-size-md)',
                        color: 'var(--color-text)'
                      }}
                    >
                      <option value="APPROVE_REFUND">Approve Refund</option>
                      <option value="APPROVE_REPAIR">Approve Repair</option>
                      <option value="APPROVE_EXCHANGE">Approve Exchange</option>
                      <option value="REJECT">Reject</option>
                    </select>
                  </div>
                  <Input 
                    label="Reason" 
                    value={decisionForm.reason ?? ''} 
                    onChange={e => setDecisionForm({ ...decisionForm, reason: e.target.value })} 
                    placeholder="E.g. Item meets return criteria" 
                    required 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'var(--font-weight-medium)' }}>Internal Notes (Optional)</label>
                    <textarea 
                      value={decisionForm.notes ?? ''} 
                      onChange={e => setDecisionForm({ ...decisionForm, notes: e.target.value })} 
                      placeholder="Additional notes for staff..." 
                      rows={3} 
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-app)',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text)',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <Button type="submit" disabled={actionLoading} style={{ width: '100%' }}>
                    {actionLoading ? 'Submitting...' : 'Submit Decision'}
                  </Button>
                </form>
              )}

              {status === 'REFUND_PENDING' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  
                  <div style={{ marginBottom: 'var(--space-2)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)' }}>Refund Summary</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Case Code</span>
                        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{caseData.caseCode}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Customer</span>
                        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{caseData.customerId}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Product</span>
                        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{caseData.product?.name || '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Inspector Recommendation</span>
                        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{inspection?.recommendedOutcome || caseData.inspectionDetails?.recommendedOutcome || '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Final Decision</span>
                        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{caseData.decisionDetails?.decision || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleApproveRefund} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <Input 
                      label="Refund Amount" 
                      type="number" 
                      min="1"
                      value={approveRefundForm.amount ?? ''} 
                      onChange={e => setApproveRefundForm({ ...approveRefundForm, amount: e.target.value })} 
                      required 
                    />
                    <Input 
                      label="Currency" 
                      value={approveRefundForm.currency ?? ''} 
                      onChange={e => setApproveRefundForm({ ...approveRefundForm, currency: e.target.value })} 
                      required 
                    />
                    <Input 
                      label="Reason" 
                      value={approveRefundForm.reason ?? ''} 
                      onChange={e => setApproveRefundForm({ ...approveRefundForm, reason: e.target.value })} 
                      required 
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'var(--font-weight-medium)' }}>Approval Notes</label>
                      <textarea 
                        value={approveRefundForm.notes ?? ''} 
                        onChange={e => setApproveRefundForm({ ...approveRefundForm, notes: e.target.value })} 
                        rows={3} 
                        style={{
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-bg-app)',
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-text)',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    <Button type="submit" disabled={actionLoading} style={{ width: '100%', backgroundColor: 'var(--color-success)', color: 'white' }}>
                      {actionLoading ? 'Processing...' : 'Approve Refund'}
                    </Button>
                  </form>
                </div>
              )}

              {status === 'REFUND_APPROVED' && (
                <form onSubmit={handleRecordRefund} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Record the final refund payment details to close the loop.
                  </p>
                  <Input 
                    label="Reference Number" 
                    value={recordRefundForm.referenceNumber ?? ''} 
                    onChange={e => setRecordRefundForm({ ...recordRefundForm, referenceNumber: e.target.value })} 
                    required 
                  />
                  <Input 
                    label="Debit Account" 
                    value={recordRefundForm.debitAccount ?? ''} 
                    onChange={e => setRecordRefundForm({ ...recordRefundForm, debitAccount: e.target.value })} 
                    required 
                  />
                  <Input 
                    label="Credit Account" 
                    value={recordRefundForm.creditAccount ?? ''} 
                    onChange={e => setRecordRefundForm({ ...recordRefundForm, creditAccount: e.target.value })} 
                    required 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'var(--font-weight-medium)' }}>Payment Notes</label>
                    <textarea 
                      value={recordRefundForm.notes ?? ''} 
                      onChange={e => setRecordRefundForm({ ...recordRefundForm, notes: e.target.value })} 
                      rows={3} 
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-app)',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text)',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <Button type="submit" disabled={actionLoading} style={{ width: '100%' }}>
                    {actionLoading ? 'Recording...' : 'Record Payment'}
                  </Button>
                </form>
              )}

              {!['INSPECTION_COMPLETED', 'DECISION_PENDING', 'REFUND_PENDING', 'REFUND_APPROVED', 'CASE_CREATED', 'ITEM_COLLECTED', 'IN_TRANSIT'].includes(status) && (
                <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                  <CheckCircle size={32} color="var(--color-text-secondary)" style={{ margin: '0 auto var(--space-2)' }} />
                  <div style={{ fontWeight: 'var(--font-weight-medium)' }}>No Action Required</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Case is currently in <StatusBadge status={status} />.
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}
