import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardRouteForRole } from '../utils/auth';

export function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null; // Or return a LoadingState component
  }

  if (!isAuthenticated) {
    // Redirect to login but save the attempted location to redirect back (optional)
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = user?.role?.toUpperCase();

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // User is logged in but doesn't have the right role
    // Redirect them to their correct dashboard
    const targetRoute = getDashboardRouteForRole(userRole);
    return <Navigate to={targetRoute} replace />;
  }

  return <Outlet />;
}
