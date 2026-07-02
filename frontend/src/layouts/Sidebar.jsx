import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PackageSearch, 
  Wrench, 
  RefreshCcw, 
  MapPin, 
  Settings,
  PlusCircle,
  Bell,
  Inbox,
  Truck,
  ClipboardList,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

export function Sidebar() {
  const { user } = useAuth();
  const basePath = user?.role ? `/${user.role.toLowerCase()}/dashboard` : '/dashboard';

  let navigation = [];

  if (user?.role === 'CUSTOMER') {
    navigation = [
      { name: 'Overview', href: '/customer/dashboard', icon: LayoutDashboard },
      { name: 'My Cases', href: '/customer/cases', icon: Inbox },
      { name: 'New Case', href: '/customer/cases/new', icon: PlusCircle },
      { name: 'Notifications', href: '/notifications', icon: Bell },
    ];
  } else if (user?.role === 'ADMIN') {
    navigation = [
      { name: 'Operations Center', href: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'All Cases', href: '/admin/cases', icon: PackageSearch },
      { name: 'Facilities', href: '/admin/facilities', icon: MapPin },
      { name: 'Settings', href: '#', icon: Settings, disabled: true },
    ];
  } else if (user?.role === 'COURIER') {
    navigation = [
      { name: 'Deliveries', href: '/courier/dashboard', icon: Truck },
    ];
  } else if (user?.role === 'INSPECTOR') {
    navigation = [
      { name: 'Inspection Workbench', href: '/inspector/dashboard', icon: Wrench },
      { name: 'Assigned Inspections', href: '/inspector/assigned', icon: ClipboardList },
      { name: 'Completed Inspections', href: '/inspector/completed', icon: CheckCircle },
      { name: 'Notifications', href: '/notifications', icon: Bell },
    ];
  } else {
    navigation = [
      { name: 'Overview', href: basePath, icon: LayoutDashboard },
    ];
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-logo">RL</div>
          <span className="brand-text">ReclaimLoop</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <div className="nav-group">
          <h4 className="nav-group-title">Operations</h4>
          <ul className="nav-list">
            {navigation.map((item) => (
              <li key={item.name}>
                {item.disabled ? (
                  <div className="nav-item disabled" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                    <item.icon className="nav-icon" size={18} />
                    <span>{item.name}</span>
                  </div>
                ) : (
                  <NavLink 
                    to={item.href} 
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    end={item.href === basePath || item.href === '/admin/dashboard'}
                  >
                    <item.icon className="nav-icon" size={18} />
                    <span>{item.name}</span>
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
