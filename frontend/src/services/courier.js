import api from './api';

export const getCourierDashboard = async () => {
  const response = await api.get('/dashboard/courier');
  return response.data?.data || response.data;
};

export const getMyPickups = async () => {
  const response = await api.get('/pickups/my');
  return response.data?.data?.pickups || response.data?.data || response.data || [];
};

export const getPickupDetail = async (pickupId) => {
  try {
    const response = await api.get(`/pickups/${pickupId}`);
    const data = response.data?.data || response.data;
    if (data.pickup) {
      return {
        ...data.pickup,
        caseData: data.recoveryCase,
        facility: data.facility
      };
    }
  } catch (err) {
    // fallback to list if endpoint fails
  }

  const pickups = await getMyPickups();
  const pickup = pickups.find(p => p._id === pickupId);
  
  if (!pickup) {
    throw new Error('Pickup not found');
  }

  // Fetch associated case data for product info
  const caseRes = await api.get(`/cases/${pickup.caseId}`);
  pickup.caseData = caseRes.data?.data?.case || caseRes.data?.data || caseRes.data;
  
  return pickup;
};

export const getPickupTimeline = async (caseId) => {
  const response = await api.get(`/cases/${caseId}/timeline`);
  return response.data?.data?.events || response.data?.data || response.data || [];
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
