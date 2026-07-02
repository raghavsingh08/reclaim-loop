import api from './api';

export const getCustomerDashboard = async () => {
  const response = await api.get('/dashboard/customer');
  return response.data?.data || response.data;
};

export const listCases = async () => {
  const response = await api.get('/cases');
  return response.data?.data || response.data;
};

export const getCaseById = async (caseId) => {
  const response = await api.get(`/cases/${caseId}`);
  return response.data?.data || response.data;
};

export const getCaseTimeline = async (caseId) => {
  const response = await api.get(`/cases/${caseId}/timeline`);
  return response.data?.data || response.data;
};

export const createCase = async (caseData) => {
  const response = await api.post('/cases', caseData);
  return response.data?.data || response.data;
};
