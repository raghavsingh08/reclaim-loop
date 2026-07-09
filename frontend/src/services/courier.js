import api from './api';

export const getCourierDashboard = async () => {
  const response = await api.get('/dashboard/courier');
  return response.data?.data || response.data;
};

export const getMyPickups = async ({ cursor, limit } = {}) => {
  const response = await api.get('/pickups/my', {
    params: {
      ...(cursor && { cursor }),
      ...(limit !== undefined && { limit }),
    },
  });
  const data = response.data?.data || response.data;
  return {
    pickups: data?.pickups ?? [],
    pageInfo: data?.pageInfo ?? { nextCursor: null, hasNextPage: false },
  };
};

export const getPickupDetail = async (pickupId) => {
  const response = await api.get(`/pickups/${pickupId}`);
  const data = response.data?.data || response.data;
  return {
    ...data.pickup,
    caseData: data.recoveryCase,
    facility: data.facility,
  };
};

export const getPickupIdForCase = async (caseId) => {
  const response = await api.get(`/cases/${caseId}`);
  const data = response.data?.data || response.data;
  return data?.case?.pickupId ?? data?.recoveryCase?.pickupId ?? data?.pickupId ?? null;
};

export const getPickupTimeline = async (caseId, { cursor, limit } = {}) => {
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

export const acceptPickup = async (pickupId) => {
  const response = await api.patch(`/pickups/${pickupId}/accept`);
  return response.data?.data || response.data;
};

export const collectPickup = async (pickupId, proof = {}) => {
  const response = await api.patch(`/pickups/${pickupId}/collect`, { proof });
  return response.data?.data || response.data;
};

export const deliverPickup = async (pickupId, proof = {}) => {
  const response = await api.patch(`/pickups/${pickupId}/deliver`, { proof });
  return response.data?.data || response.data;
};
