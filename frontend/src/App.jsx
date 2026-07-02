import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

import { PublicLayout } from './layouts/PublicLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ErrorPage } from './pages/ErrorPage';
import { NotFound } from './pages/NotFound';

import { CustomerDashboard } from './pages/dashboards/CustomerDashboard';
import { CaseList } from './pages/customer/CaseList';
import { CreateCase } from './pages/customer/CreateCase';
import { CaseDetail } from './pages/customer/CaseDetail';
import { Notifications } from './pages/shared/Notifications';

import { CourierDashboard } from './pages/dashboards/CourierDashboard';
import { CourierPickupDetail } from './pages/courier/CourierPickupDetail';
import { InspectorDashboard } from './pages/dashboards/InspectorDashboard';
import { InspectorAssigned } from './pages/dashboards/InspectorAssigned';
import { InspectorCompleted } from './pages/dashboards/InspectorCompleted';
import { InspectorCaseDetail } from './pages/inspector/InspectorCaseDetail';
import { AdminDashboard } from './pages/dashboards/AdminDashboard';
import { AdminCases } from './pages/admin/AdminCases';
import { AdminCaseDetail } from './pages/admin/AdminCaseDetail';
import { AdminFacilities } from './pages/admin/AdminFacilities';

import { getDashboardRouteForRole } from './utils/auth';
import { useAuth } from './contexts/AuthContext';

function RootRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) return null;
  
  if (isAuthenticated) {
    return <Navigate to={getDashboardRouteForRole(user?.role)} replace />;
  }
  
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/dashboard" element={<RootRedirect />} />
            
            {/* Public Routes */}
            <Route element={<PublicLayout />} errorElement={<ErrorPage />}>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
            </Route>

            {/* Customer Routes */}
            <Route path="/customer" element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="dashboard" element={<CustomerDashboard />} />
                <Route path="cases/new" element={<CreateCase />} />
                <Route path="cases/:caseId" element={<CaseDetail />} />
                <Route path="cases" element={<CaseList />} />
              </Route>
            </Route>

            {/* Shared Authenticated Routes */}
            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'COURIER', 'INSPECTOR', 'ADMIN']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/notifications" element={<Notifications />} />
              </Route>
            </Route>

            {/* Courier Routes */}
            <Route path="/courier" element={<ProtectedRoute allowedRoles={['COURIER']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="dashboard" element={<CourierDashboard />} />
                <Route path="pickups/:pickupId" element={<CourierPickupDetail />} />
              </Route>
            </Route>

            {/* Inspector Routes */}
            <Route path="/inspector" element={<ProtectedRoute allowedRoles={['INSPECTOR']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="dashboard" element={<InspectorDashboard />} />
                <Route path="assigned" element={<InspectorAssigned />} />
                <Route path="completed" element={<InspectorCompleted />} />
                <Route path="cases/:caseId" element={<InspectorCaseDetail />} />
              </Route>
            </Route>

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route element={<DashboardLayout />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="cases" element={<AdminCases />} />
                <Route path="cases/:caseId" element={<AdminCaseDetail />} />
                <Route path="facilities" element={<AdminFacilities />} />
              </Route>
            </Route>

            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
