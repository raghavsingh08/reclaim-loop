import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api";
const ADMIN_JWT = process.env.ADMIN_JWT;
const CASE_ID = "6a4ca6c2cff028e71f2d5d07";
const COURIER_ID = "6a45760e76484c23592c0248";
const FACILITY_ID = "6a46088aa642e63ffbe53cf2";

if (!ADMIN_JWT) {
  throw new Error("ADMIN_JWT environment variable is required");
}

const body = {
  caseId: CASE_ID,
  courierId: COURIER_ID,
  facilityId: FACILITY_ID,
  scheduledWindow: {
    start: "2026-07-08T10:00:00.000Z",
    end: "2026-07-08T12:00:00.000Z",
  },
};

const configA = {
  headers: {
    Authorization: `Bearer ${ADMIN_JWT}`,
    "Content-Type": "application/json",
    "Idempotency-Key": "pickup-different-key-20260707-a1",
  },
};

const configB = {
  headers: {
    Authorization: `Bearer ${ADMIN_JWT}`,
    "Content-Type": "application/json",
    "Idempotency-Key": "pickup-different-key-20260707-b1",
  },
};

function show(label, result) {
  if (result.status === "fulfilled") {
    console.log(label, result.value.status, result.value.data);
  } else {
    console.log(
      label,
      result.reason.response?.status,
      result.reason.response?.data || result.reason.message
    );
  }
}

const results = await Promise.allSettled([
  axios.post(`${API_BASE_URL}/pickups/assign`, body, configA),
  axios.post(`${API_BASE_URL}/pickups/assign`, body, configB),
]);

show("Request A:", results[0]);
show("Request B:", results[1]);
