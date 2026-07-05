import axios from 'axios';

/*
 * Temporary local concurrency check for Assign Inspector.
 *
 * Before running:
 * 1. Start the backend and ensure CASE_ID is in FACILITY_RECEIVED or
 *    REINSPECTION_REQUESTED status.
 * 2. Paste a valid ADMIN JWT and two active INSPECTOR user IDs below, or set
 *    the matching environment variables.
 * 3. From /backend run:
 *      node scripts/dev/test-assign-inspector-concurrency.js
 *
 * Use a fresh eligible case for every run because the successful request moves
 * the case to INSPECTION_ASSIGNED.
 */

const API_BASE_URL = 'http://localhost:5000/api';
const ADMIN_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQURNSU4iLCJpYXQiOjE3ODMyMzQ1NjAsImV4cCI6MTc4MzMyMDk2MCwic3ViIjoiNmE0NTc2OGY3NjQ4NGMyMzU5MmMwMjRiIn0.TJvDTfFxOmLSSnhK_fmJbPTFg2Zy0lHj8WSQyQwIzKg';
const CASE_ID ='6a4a0311a37459e7306b5d20';
const INSPECTOR_A_ID = '6a4683477959d7edb781a657';
const INSPECTOR_B_ID = '6a49ff78621c0a859125553b';

const placeholders = [ADMIN_JWT, CASE_ID, INSPECTOR_A_ID, INSPECTOR_B_ID];
if (placeholders.some((value) => value.startsWith('PASTE_'))) {
  console.error('Configure ADMIN_JWT, CASE_ID, INSPECTOR_A_ID, and INSPECTOR_B_ID before running.');
  process.exitCode = 1;
} else {
  const url = `${API_BASE_URL}/inspections/${CASE_ID}/assign`;
  const config = {
    headers: { Authorization: `Bearer ${ADMIN_JWT}` },
  };

  const results = await Promise.allSettled([
    axios.post(url, { inspectorId: INSPECTOR_A_ID }, config),
    axios.post(url, { inspectorId: INSPECTOR_B_ID }, config),
  ]);

  const summarize = (result, label) => {
    const response = result.status === 'fulfilled'
      ? result.value
      : result.reason?.response;
    const status = response?.status ?? 'NO_RESPONSE';
    const message = response?.data?.message ?? result.reason?.message ?? 'No message';

    console.log(`${label}: status=${status}, message=${message}`);
    return {
      succeeded: typeof status === 'number' && status >= 200 && status < 300,
      conflict: status === 409,
    };
  };

    function formatResult(label, result) {
    if (result.status === "fulfilled") {
      return {
        label,
        ok: true,
        status: result.value.status,
        data: result.value.data,
      };
    }

    const error = result.reason;

    return {
      label,
      ok: false,
      code: error.code,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    };
  }

  console.dir(formatResult("Request A", results[0]), { depth: null });
  console.dir(formatResult("Request B", results[1]), { depth: null });
}
