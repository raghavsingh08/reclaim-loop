import api from './api';

export const getCustomerDashboard = async () => {
  const response = await api.get('/dashboard/customer');
  return response.data?.data || response.data;
};

export const listCases = async ({ cursor, limit } = {}) => {
  const response = await api.get('/cases', {
    params: {
      ...(cursor && { cursor }),
      ...(limit !== undefined && { limit }),
    },
  });
  return response.data?.data || response.data;
};

export const getCaseById = async (caseId) => {
  const response = await api.get(`/cases/${caseId}`);
  return response.data?.data || response.data;
};

export const getCaseTimeline = async (caseId, { cursor, limit } = {}) => {
  const response = await api.get(`/cases/${caseId}/timeline`, {
    params: {
      ...(cursor && { cursor }),
      ...(limit !== undefined && { limit }),
    },
  });
  const data = response.data?.data || response.data || {};
  return {
    events: data.events ?? [],
    pageInfo: data.pageInfo ?? {
      nextCursor: null,
      hasNextPage: false,
    },
  };
};

export const createCase = async (caseData) => {
  const response = await api.post('/cases', caseData);
  return response.data?.data || response.data;
};
