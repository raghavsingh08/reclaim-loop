import api from './api';

export const getAdminDashboard = async () => {
  const response = await api.get('/dashboard/admin');
  return response.data?.data || response.data;
};

export const listAllCases = async () => {
  const response = await api.get('/cases');
  return response.data?.data || response.data;
};

export const getFacilities = async () => {
  const response = await api.get('/facilities');
  return response.data?.data || response.data;
};

export const getCaseById = async (caseId) => {
  const response = await api.get(`/cases/${caseId}`);
  return response.data?.data?.case || response.data?.data?.recoveryCase || response.data?.data || response.data;
};

export const getCaseTimeline = async (caseId) => {
  const response = await api.get(`/cases/${caseId}/timeline`);
  return response.data?.data?.events || response.data?.data?.timeline || response.data?.data || response.data;
};

export const getCaseDecisions = async (caseId) => {
  const response = await api.get(`/decisions/${caseId}`);
  return response.data?.data?.decisions || response.data?.data || response.data || [];
};

export const getCaseRefunds = async (caseId) => {
  const response = await api.get(`/refunds/${caseId}`);
  return response.data?.data?.ledgerEntries || response.data?.data || response.data || [];
};

export const startReview = async (caseId) => {
  const response = await api.post(`/decisions/${caseId}/start-review`);
  return response.data?.data || response.data;
};

export const makeDecision = async (caseId, data) => {
  const response = await api.post(`/decisions/${caseId}/decide`, data);
  return response.data?.data || response.data;
};

export const approveRefund = async (caseId, data) => {
  const response = await api.post(`/refunds/${caseId}/approve`, data);
  return response.data?.data || response.data;
};

export const recordRefund = async (caseId, data) => {
  const response = await api.post(`/refunds/${caseId}/record`, data);
  return response.data?.data || response.data;
};

export const assignPickup = async (data, idempotencyKey) => {
  const config = idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {};
  const response = await api.post('/pickups/assign', data, config);
  return response.data?.data || response.data;
};

export const receiveAtFacility = async (facilityId, caseId) => {
  const response = await api.patch(`/facilities/${facilityId}/receive/${caseId}`);
  return response.data?.data || response.data;
};

export const getInspectors = async () => {
  const response = await api.get('/users?role=INSPECTOR');
  return response.data?.data?.users || response.data?.data || response.data || [];
};

export const assignInspector = async (caseId, inspectorId, idempotencyKey) => {
  const config = idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {};
  const response = await api.post(`/inspections/${caseId}/assign`, { inspectorId }, config);
  return response.data?.data || response.data;
};

export const getCaseInspection = async (caseId) => {
  try {
    const response = await api.get(`/inspections/${caseId}`);
    return response.data?.data?.inspection || response.data?.data || response.data || null;
  } catch (err) {
    if (err.response?.status === 400 || err.response?.status === 404) return null;
    throw err;
  }
};
