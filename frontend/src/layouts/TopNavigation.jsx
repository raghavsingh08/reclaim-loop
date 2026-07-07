import React, { useCallback, useState, useEffect } from 'react';
import { Bell, Search, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getNotifications } from '../services/notifications';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import './TopNavigation.css';
import { useNotificationsRealtime } from '../hooks/useNotificationsRealtime';

export function TopNavigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const { isDesktop } = useResponsiveLayout();

  const refreshUnreadCount = useCallback(async () => {
    if (!user || location.pathname.includes('/login')) return;
    const data = await getNotifications();
    const count = data.notifications?.filter(notification => !notification.isRead).length || 0;
    setUnreadCount(count);
  }, [location.pathname, user]);

  useEffect(() => {
    refreshUnreadCount().catch(console.error);
    window.addEventListener('notifications:refresh', refreshUnreadCount);
    return () => window.removeEventListener('notifications:refresh', refreshUnreadCount);
  }, [refreshUnreadCount]);

  useNotificationsRealtime(refreshUnreadCount);

  return (
    <header className="top-nav">
      <div className="top-nav-left">
        <div className="search-bar">
          <Search className="search-icon" size={16} />
          <input 
            type="text" 
            placeholder="Search cases..." 
            className="search-input"
            aria-label="Search"
          />
          {isDesktop && <div className="search-shortcut">/</div>}
        </div>
      </div>
      
      <div className="top-nav-right">
        <button 
          className="nav-icon-btn" 
          style={{ position: 'relative' }} 
          onClick={() => navigate('/notifications')}
          title="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              backgroundColor: 'var(--color-danger)',
              color: 'white',
              fontSize: '10px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        
        <div className="user-profile">
          <div className="avatar">
            <User size={16} />
          </div>
          <span className="user-name">{user?.name || 'User'}</span>
        </div>
        
        <button className="nav-icon-btn" onClick={() => logout()} title="Logout">
          <span style={{ fontSize: '12px', padding: '0 8px' }}>Logout</span>
        </button>
      </div>
    </header>
  );
}
