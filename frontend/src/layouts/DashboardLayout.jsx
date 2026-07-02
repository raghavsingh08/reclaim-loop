import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';
import { useAuth } from '../contexts/AuthContext';
import './DashboardLayout.css';

export function DashboardLayout() {
  const { loading } = useAuth();

  if (loading) {
    return null; // Or a global loading spinner
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <TopNavigation />
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
