import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getCourierDashboard, getMyPickups, acceptPickup, collectPickup } from '../../services/courier';
import { Truck, MapPin, Calendar, Clock, CheckCircle } from 'lucide-react';
import './CourierDashboard.css';

export function CourierDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // stores pickupId being acted upon

  const loadData = async () => {
    try {
      const [dashboardData, myPickupsData] = await Promise.all([
        getCourierDashboard(),
        getMyPickups()
      ]);
      setStats(dashboardData);
      setPickups(myPickupsData);
    } catch (err) {
      setError(err.message || 'Failed to load courier data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAction = async (pickupId, actionType) => {
    setActionLoading(pickupId);
    try {
      if (actionType === 'ACCEPT') {
        await acceptPickup(pickupId);
      } else if (actionType === 'COLLECT') {
        await collectPickup(pickupId);
      }
      await loadData();
    } catch (err) {
      alert(err.message || `Failed to ${actionType.toLowerCase()} pickup`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !stats) return <LoadingState text="Loading logistics dashboard..." />;
  if (error) return <EmptyState title="Error" description={error} />;

  return (
    <div className="courier-dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Logistics Center</h1>
          <p className="dashboard-subtitle">
            Welcome back, {user?.name}. Here are your daily pickup tasks.
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <Card>
          <CardContent className="kpi-card-content">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              <Truck size={24} />
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Assigned Pickups</span>
              <span className="kpi-value">{stats?.assignedPickups || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="kpi-card-content">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#eab308' }}>
              <Clock size={24} />
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Accepted (Pending Collection)</span>
              <span className="kpi-value">{stats?.acceptedPickups || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="kpi-card-content">
            <div className="kpi-icon-wrapper" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <CheckCircle size={24} />
            </div>
            <div className="kpi-details">
              <span className="kpi-label">Completed Today</span>
              <span className="kpi-value">{stats?.completedPickups || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="pickups-section">
        <h2 className="section-title">My Pickups</h2>
        
        {pickups.length > 0 ? (
          <div className="pickups-list">
            {pickups.map(pickup => (
              <Card 
                key={pickup._id} 
                className="pickup-card"
                style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                onClick={() => navigate(`/courier/pickups/${pickup._id}`)}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-app)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg)'}
              >
                <CardContent className="pickup-card-content">
                  
                  <div className="pickup-info">
                    <div className="pickup-header">
                      <span className={`status-badge status-${pickup.status.toLowerCase()}`}>
                        {pickup.status}
                      </span>
                      <span className="case-id">Case: {pickup.caseId.substring(0,8)}...</span>
                    </div>

                    <div className="pickup-details">
                      <div className="detail-item">
                        <MapPin size={16} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>Pickup From</span>
                          <span>
                            {pickup.pickupAddress?.line1}, {pickup.pickupAddress?.city}, {pickup.pickupAddress?.state} {pickup.pickupAddress?.pincode}
                          </span>
                        </div>
                      </div>
                      
                      {pickup.facilityId?.name && (
                        <div className="detail-item">
                          <MapPin size={16} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>Deliver To</span>
                            <span>{pickup.facilityId.name}, {pickup.facilityId.address?.city || 'Facility'}</span>
                          </div>
                        </div>
                      )}

                      <div className="detail-item">
                        <Calendar size={16} />
                        <span>
                          {new Date(pickup.scheduledWindow?.start).toLocaleString()} - {new Date(pickup.scheduledWindow?.end).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pickup-actions" onClick={e => e.stopPropagation()}>
                    {pickup.status === 'ASSIGNED' && (
                      <Button 
                        onClick={(e) => { e.stopPropagation(); handleAction(pickup._id, 'ACCEPT'); }} 
                        disabled={actionLoading === pickup._id}
                      >
                        {actionLoading === pickup._id ? 'Accepting...' : 'Accept Pickup'}
                      </Button>
                    )}
                    {pickup.status === 'ACCEPTED' && (
                      <Button 
                        onClick={(e) => { e.stopPropagation(); handleAction(pickup._id, 'COLLECT'); }} 
                        disabled={actionLoading === pickup._id}
                        style={{ backgroundColor: 'var(--color-success)', color: 'white' }}
                      >
                        {actionLoading === pickup._id ? 'Collecting...' : 'Mark Collected'}
                      </Button>
                    )}
                    {pickup.status === 'COLLECTED' && (
                      <Button disabled variant="outline">
                        <CheckCircle size={16} style={{ marginRight: '8px' }} />
                        Completed
                      </Button>
                    )}
                    {pickup.status === 'FAILED' && (
                      <Button disabled variant="outline" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                        Failed
                      </Button>
                    )}
                  </div>

                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState 
            icon={Truck} 
            title="No pickups assigned" 
            description="You do not have any pickups assigned to you right now." 
          />
        )}
      </div>
    </div>
  );
}
