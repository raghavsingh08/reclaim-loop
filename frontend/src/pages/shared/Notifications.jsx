import React, { useEffect, useState } from 'react';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../services/notifications';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { Bell, Check, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getMyPickups } from '../../services/courier';

export function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const fetchNotifications = () => {
    getNotifications()
      .then(data => setNotifications(data.notifications || data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation(); // prevent navigation if clicked
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      markNotificationAsRead(notification._id).catch(console.error);
    }
    if (notification.caseId && user?.role) {
      const role = user.role.toUpperCase();
      
      if (role === 'COURIER') {
        try {
          const pickups = await getMyPickups();
          const pickup = pickups.find(p => 
            String(p.caseId) === String(notification.caseId) || 
            String(p.caseId?._id) === String(notification.caseId)
          );
          if (pickup) {
            navigate(`/courier/pickups/${pickup._id}`);
          } else {
            showToast("Pickup not found for this notification.");
          }
        } catch (err) {
          console.error(err);
          showToast("Error finding pickup");
        }
      } else if (role === 'INSPECTOR') {
        navigate(`/inspector/inspections/${notification.caseId}`);
      } else if (role === 'ADMIN') {
        navigate(`/admin/cases/${notification.caseId}`);
      } else if (role === 'CUSTOMER') {
        navigate(`/customer/cases/${notification.caseId}`);
      }
    }
  };

  if (loading) return <LoadingState text="Loading notifications..." />;
  if (error) return <EmptyState title="Failed to load notifications" description={error} />;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>Notifications</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Stay updated on system alerts and events.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle2 size={16} />
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {notifications.map(notif => (
            <Card 
              key={notif._id} 
              style={{ 
                cursor: notif.caseId ? 'pointer' : 'default',
                transition: 'background-color 0.2s',
                backgroundColor: notif.isRead ? 'var(--color-bg)' : 'var(--color-bg-app)'
              }}
              onClick={() => handleNotificationClick(notif)}
            >
              <CardContent style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                <div style={{ 
                  backgroundColor: notif.isRead ? 'var(--color-bg-secondary)' : 'var(--color-primary-light)', 
                  color: notif.isRead ? 'var(--color-text-secondary)' : 'var(--color-primary)',
                  padding: 'var(--space-2)',
                  borderRadius: '50%'
                }}>
                  <Bell size={20} />
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-1)' }}>
                    <h4 style={{ 
                      fontSize: 'var(--font-size-md)', 
                      fontWeight: notif.isRead ? 'var(--font-weight-medium)' : 'var(--font-weight-bold)',
                      color: 'var(--color-text)'
                    }}>
                      {notif.title}
                    </h4>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                    {notif.message}
                  </p>
                  {notif.metadata?.caseCode && (
                    <span style={{ 
                      fontSize: '12px', 
                      backgroundColor: 'var(--color-bg-secondary)', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      fontWeight: 'var(--font-weight-medium)'
                    }}>
                      Case: {notif.metadata.caseCode}
                    </span>
                  )}
                </div>

                {!notif.isRead && (
                  <Button 
                    variant="ghost" 
                    onClick={(e) => handleMarkAsRead(e, notif._id)}
                    title="Mark as read"
                    style={{ padding: 'var(--space-2)' }}
                  >
                    <Check size={18} />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState 
          icon={Bell} 
          title="All caught up!" 
          description="You don't have any notifications right now." 
        />
      )}
      
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--color-bg-reverse)',
          color: 'var(--color-text-reverse)',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          fontWeight: 'var(--font-weight-medium)'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
