import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getInspectorDashboard, getMyInspections, getAwaitingReceiptCases, receiveCase } from '../../services/inspector';
import { Wrench, CheckCircle, ClipboardList, MapPin, Search, ArrowRight, Package, Clock } from 'lucide-react';
import './InspectorDashboard.css';

export function InspectorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [awaitingCases, setAwaitingCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadData = async () => {
    try {
      const [dashboardData, myInspectionsData, awaiting] = await Promise.all([
        getInspectorDashboard(),
        getMyInspections(),
        getAwaitingReceiptCases()
      ]);
      setStats(dashboardData);
      setInspections(myInspectionsData);
      setAwaitingCases(awaiting);
    } catch (err) {
      setError(err.message || 'Failed to load inspector data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReceive = async (facilityId, caseId) => {
    if (!facilityId) {
      alert("No facility assigned.");
      return;
    }
    try {
      await receiveCase(facilityId, caseId);
      setSuccessMsg("Item received successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to receive item');
    }
  };


  if (loading && !stats) return <LoadingState text="Loading workbench data..." />;
  if (error) return <EmptyState title="System Error" description={error} />;

  const pendingQueue = inspections.filter(i => {
    const statusMatch = ['PENDING', 'IN_PROGRESS', 'ASSIGNED'].includes(i.status);
    const caseStatusMatch = ['INSPECTION_ASSIGNED', 'INSPECTION_PENDING'].includes(i.case?.status || i.recoveryCase?.status);
    return statusMatch || caseStatusMatch;
  });
  const completedQueue = inspections.filter(i => i.status === 'COMPLETED' || i.case?.status === 'INSPECTION_COMPLETED' || i.recoveryCase?.status === 'INSPECTION_COMPLETED');
  
  const getCaseId = (inspection) => {
    return inspection.caseId?._id || inspection.caseId || inspection.case?._id || inspection.case || inspection.recoveryCase?._id || inspection.recoveryCase;
  };
  
  const getCaseObj = (inspection) => {
    return inspection.caseId?.caseCode ? inspection.caseId :
           inspection.recoveryCase?.caseCode ? inspection.recoveryCase :
           inspection.case?.caseCode ? inspection.case : null;
  };

  const getCaseCode = (inspection) => {
    const obj = getCaseObj(inspection);
    if (obj?.caseCode) return obj.caseCode;
    const id = getCaseId(inspection);
    return typeof id === 'string' ? id.substring(0,8) : 'Case';
  };

  const getProduct = (inspection) => {
    const obj = getCaseObj(inspection);
    return obj?.product || inspection.productDetails || null;
  };

  const getFacility = (inspection) => {
    if (inspection.facilityId?.name) return inspection.facilityId;
    if (inspection.facilityDetails?.name) return inspection.facilityDetails;
    return null;
  };
  const pendingReviewQueue = completedQueue.slice(0, 3); // Mocking pending review
  const recentCompletedQueue = completedQueue.slice(3, 8);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const assignedToday = inspections.filter(i => new Date(i.createdAt) >= today).length;

  return (
    <div className="inspector-workbench">
      <div className="workbench-header">
        <div>
          <h1 className="workbench-title">Inspection Workbench</h1>
          <p className="workbench-subtitle">
            Review received items, complete inspections, and submit recommendations.
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <Card>
          <CardContent className="kpi-card-content">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#eab308' }}>
              <ClipboardList size={24} />
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Pending Inspections</span>
              <span className="kpi-value">{stats?.pendingInspections || pendingQueue.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="kpi-card-content">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <CheckCircle size={24} />
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Completed Inspections</span>
              <span className="kpi-value">{stats?.completedInspections || completedQueue.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="kpi-card-content">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              <Wrench size={24} />
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Assigned Today</span>
              <span className="kpi-value">{assignedToday}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="workbench-layout">
        
        {/* Main Panel: Inspection Queue */}
        <div className="main-panel">
          
          {successMsg && (
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} /> {successMsg}
            </div>
          )}

          {awaitingCases.length > 0 && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 className="panel-title">Awaiting Facility Receipt</h2>
              <Card style={{ border: '2px solid var(--color-primary)' }}>
                <div className="table-responsive">
                  <table className="workbench-table">
                    <thead>
                      <tr>
                        <th>Case ID</th>
                        <th>Product</th>
                        <th>Facility</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {awaitingCases.map((c) => (
                        <tr key={c._id}>
                          <td><span className="case-code-mono">{c.caseCode}</span></td>
                          <td>
                            <div className="product-cell">
                              <span className="product-name">{c.product?.name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td>
                            <div className="facility-cell">
                              <MapPin size={12} color="var(--color-text-secondary)" />
                              {c.assignedFacility?.name || c.assignedFacilityId || 'Unknown'}
                            </div>
                          </td>
                          <td>
                            <span className={`status-chip status-pending`}>
                              {c.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => handleReceive(c.assignedFacilityId || c.assignedFacility?._id, c._id)}
                            >
                              Receive Item
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          <h2 className="panel-title">Assigned Inspections</h2>
          {pendingQueue.length > 0 ? (
            <Card>
              <div className="table-responsive">
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Case ID</th>
                      <th>Product</th>
                      <th>Facility</th>
                      <th>Status</th>
                      <th>Assigned</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingQueue.map((inspection) => (
                      <tr key={inspection._id}>
                        <td>
                          <span className="case-code-mono">
                            {getCaseCode(inspection)}
                          </span>
                        </td>
                        <td>
                          <div className="product-cell">
                            <span className="product-name">{getProduct(inspection)?.name || 'Unknown Product'}</span>
                            <span className="product-category">{getProduct(inspection)?.category || ''}</span>
                            {getProduct(inspection)?.condition && (
                              <span className="product-condition">Cond: {getProduct(inspection).condition}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="facility-cell">
                            <MapPin size={12} color="var(--color-text-secondary)" />
                            {getFacility(inspection) ? (
                              <span>
                                {getFacility(inspection).name}
                                {getFacility(inspection).address && (
                                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block' }}>
                                    {getFacility(inspection).address.city} - {getFacility(inspection).address.pincode}
                                  </span>
                                )}
                              </span>
                            ) : '-'}
                          </div>
                        </td>
                        <td>
                          <span className={`status-chip status-${inspection.status.toLowerCase()}`}>
                            {inspection.status.replace(/_/g, ' ')}
                            {getCaseObj(inspection)?.status && getCaseObj(inspection).status !== inspection.status && (
                               <span style={{ display: 'block', fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                                 {getCaseObj(inspection).status.replace(/_/g, ' ')}
                               </span>
                            )}
                          </span>
                        </td>
                        <td className="date-cell">
                          {new Date(inspection.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => navigate(`/inspector/cases/${getCaseId(inspection)}`)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
                          >
                            Open <ArrowRight size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <EmptyState 
              icon={Search} 
              title="Queue is empty" 
              description="No inspections have been assigned yet." 
            />
          )}
        </div>

        {/* Secondary Panel */}
        <div className="secondary-panel">
          
          <h2 className="panel-title">Pending Review</h2>
          <div className="completed-list" style={{ marginBottom: 'var(--space-6)' }}>
            {pendingReviewQueue.length > 0 ? (
              pendingReviewQueue.map(inspection => (
                <Card key={inspection._id} className="completed-card" onClick={() => navigate(`/inspector/cases/${getCaseId(inspection)}`)}>
                  <CardContent className="completed-card-content">
                    <div className="completed-header">
                      <span className="case-code-mono">
                        {getCaseCode(inspection)}
                      </span>
                      <span className="status-chip status-pending">In Review</span>
                    </div>
                    <div className="completed-body">
                      <div className="completed-product">
                        <Clock size={14} color="var(--color-text-secondary)" />
                        {getProduct(inspection)?.name || 'Unknown Product'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    No inspections pending admin review.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <h2 className="panel-title">Recently Completed</h2>
          <div className="completed-list">
            {recentCompletedQueue.length > 0 ? (
              recentCompletedQueue.map(inspection => (
                <Card key={inspection._id} className="completed-card" onClick={() => navigate(`/inspector/cases/${getCaseId(inspection)}`)}>
                  <CardContent className="completed-card-content">
                    <div className="completed-header">
                      <span className="case-code-mono">
                        {getCaseCode(inspection)}
                      </span>
                      <span className="status-chip status-completed">Completed</span>
                    </div>
                    <div className="completed-body">
                      <div className="completed-product">
                        <Package size={14} color="var(--color-text-secondary)" />
                        {getProduct(inspection)?.name || 'Unknown Product'}
                      </div>
                      <div className="completed-date">
                        {new Date(inspection.updatedAt || inspection.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <CheckCircle size={32} color="var(--color-text-secondary)" style={{ margin: '0 auto var(--space-3)' }} />
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    No recently completed inspections.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
