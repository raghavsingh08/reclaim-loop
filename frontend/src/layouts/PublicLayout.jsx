import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardRouteForRole } from '../utils/auth';
import './PublicLayout.css';

export function PublicLayout() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to={getDashboardRouteForRole(user?.role)} replace />;
  }

  return (
    <div className="public-layout">
      <main className="public-content">
        <Outlet />
      </main>
    </div>
  );
}
