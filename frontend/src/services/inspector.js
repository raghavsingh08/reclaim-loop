import api from './api';

export const getInspectorDashboard = async () => {
  try {
    const response = await api.get('/dashboard/inspector');
    return response.data?.data || response.data;
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 404) {
      return { pendingInspections: 0, completedInspections: 0 };
    }
    throw error;
  }
};

export const getMyInspections = async () => {
  try {
    const response = await api.get('/inspections/my');
    return response.data?.data?.inspections || response.data?.data || response.data || [];
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

export const getAwaitingReceiptCases = async () => {
  const response = await api.get('/cases');
  const allCases = response.data?.data?.cases || response.data?.data || response.data || [];
  return allCases.filter(c => c.status === 'DELIVERED_TO_FACILITY');
};

export const receiveCase = async (facilityId, caseId) => {
  const response = await api.patch(`/facilities/${facilityId}/receive/${caseId}`);
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

export const startInspection = async (caseId) => {
  const response = await api.post(`/inspections/${caseId}/start`);
  return response.data?.data || response.data;
};

export const completeInspection = async (caseId, data) => {
  const response = await api.post(`/inspections/${caseId}/complete`, data);
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
