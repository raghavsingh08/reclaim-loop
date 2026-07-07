/**
 * Assign Inspector idempotency integration test.
 *
 * Prerequisites:
 * - Run the development seed (`npm run seed`).
 * - Start the backend.
 *
 * Run:
 *   node scripts/dev/test-assign-inspector-idempotency.js
 *
 * Optional:
 *   $env:API_BASE_URL="http://127.0.0.1:5001"; node scripts/dev/test-assign-inspector-idempotency.js
 */
import dns from 'node:dns';
import axios from 'axios';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:5000';
const PASSWORD = process.env.TEST_USER_PASSWORD || 'Password123';
const keyPrefix = `inspection-idempotency-${Date.now()}`;
const api = axios.create({ baseURL: API_BASE_URL, validateStatus: () => true });

const caseIds = [];
let adminToken;
let facilityId;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const headers = (token, idempotencyKey) => ({
  Authorization: `Bearer ${token}`,
  ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
});

const login = async (email) => {
  const response = await api.post('/api/auth/login', { email, password: PASSWORD });
  assert(response.status === 200, `Login failed for ${email}: ${response.status}`);
  return response.data.data.token;
};

const createReadyCase = async ({ customerToken, courierToken, courierId, suffix }) => {
  const caseResponse = await api.post('/api/cases', {
    requestType: 'REFUND',
    product: {
      name: `Inspection Idempotency Product ${suffix}`,
      category: 'TEST',
      serialNumber: `${keyPrefix}-${suffix}`,
    },
    reason: 'Assign Inspector idempotency validation',
    pickupAddress: {
      line1: '1 Test Street',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
    },
  }, { headers: headers(customerToken) });
  assert(caseResponse.status === 201, `Case ${suffix} creation failed: ${caseResponse.status}`);
  const caseId = caseResponse.data.data.case._id;
  caseIds.push(caseId);

  const pickupResponse = await api.post('/api/pickups/assign', {
    caseId,
    courierId,
    facilityId,
    scheduledWindow: {
      start: new Date(Date.now() + 3_600_000).toISOString(),
      end: new Date(Date.now() + 7_200_000).toISOString(),
    },
  }, {
    headers: headers(adminToken, `${keyPrefix}-pickup-${suffix}`),
  });
  assert(pickupResponse.status === 201, `Pickup ${suffix} assignment failed: ${pickupResponse.status}`);
  const pickupId = pickupResponse.data.data.pickup._id;

  const acceptResponse = await api.patch(
    `/api/pickups/${pickupId}/accept`,
    {},
    { headers: headers(courierToken) },
  );
  assert(acceptResponse.status === 200, `Pickup ${suffix} accept failed: ${acceptResponse.status}`);

  const collectResponse = await api.patch(
    `/api/pickups/${pickupId}/collect`,
    {},
    { headers: headers(courierToken) },
  );
  assert(collectResponse.status === 200, `Pickup ${suffix} collect failed: ${collectResponse.status}`);

  const deliverResponse = await api.patch(
    `/api/pickups/${pickupId}/deliver`,
    { proof: { scanCode: `TEST-${suffix}` } },
    { headers: headers(courierToken) },
  );
  assert(deliverResponse.status === 200, `Pickup ${suffix} deliver failed: ${deliverResponse.status}`);

  const receiveResponse = await api.patch(
    `/api/facilities/${facilityId}/receive/${caseId}`,
    { proof: { scanCode: `RECEIVE-${suffix}` } },
    { headers: headers(adminToken) },
  );
  assert(receiveResponse.status === 200, `Facility receive ${suffix} failed: ${receiveResponse.status}`);
  return caseId;
};

const run = async () => {
  adminToken = await login('admin@reclaimloop.test');
  const customerToken = await login('customer@reclaimloop.test');
  const courierToken = await login('courier@reclaimloop.test');
  const inspectorToken = await login('inspector@reclaimloop.test');

  const courierResponse = await api.get('/api/users?role=COURIER', {
    headers: headers(adminToken),
  });
  const inspectorResponse = await api.get('/api/users?role=INSPECTOR', {
    headers: headers(adminToken),
  });
  const courierId = courierResponse.data.data.users[0]?._id;
  const inspectorId = inspectorResponse.data.data.users[0]?._id;
  assert(courierId && inspectorId, 'Seeded courier and inspector users are required');

  const facilityResponse = await api.post('/api/facilities', {
    name: `Inspection Test Facility ${keyPrefix}`,
    type: 'WAREHOUSE',
    location: { city: 'Delhi', state: 'Delhi', pincode: '110001' },
    supportedCategories: ['TEST'],
    capacity: { total: 10, reserved: 0, available: 10 },
  }, { headers: headers(adminToken) });
  assert(facilityResponse.status === 201, `Facility creation failed: ${facilityResponse.status}`);
  facilityId = facilityResponse.data.data.facility._id;

  const caseA = await createReadyCase({ customerToken, courierToken, courierId, suffix: 'A' });
  const keyA = `${keyPrefix}-normal-request`;
  const bodyA = { inspectorId };

  const normal = await api.post(`/api/inspections/${caseA}/assign`, bodyA, {
    headers: headers(adminToken, keyA),
  });
  assert(normal.status === 201, `Normal assignment expected 201, got ${normal.status}`);
  assert(normal.headers['x-command-id'], 'Normal assignment missing X-Command-ID');

  const replay = await api.post(`/api/inspections/${caseA}/assign`, bodyA, {
    headers: headers(adminToken, keyA),
  });
  assert(replay.status === 201, `Replay expected 201, got ${replay.status}`);
  assert(replay.headers['idempotency-replayed'] === 'true', 'Replay header missing');
  assert(replay.headers['x-command-id'] === normal.headers['x-command-id'], 'Replay command ID changed');
  assert(JSON.stringify(replay.data) === JSON.stringify(normal.data), 'Replay body changed');

  const changed = await api.post(`/api/inspections/${caseA}/assign`, {
    inspectorId: new mongoose.Types.ObjectId().toString(),
  }, { headers: headers(adminToken, keyA) });
  assert(changed.status === 422, `Changed body expected 422, got ${changed.status}`);
  assert(changed.data.code === 'IDEMPOTENCY_KEY_REUSED', 'Changed body returned wrong code');

  const timeline = await api.get(`/api/cases/${caseA}/timeline`, {
    headers: headers(adminToken),
  });
  const pickupEvent = timeline.data.data.events.find(
    (event) => event.type === 'PICKUP_ASSIGNED',
  );
  const inspectionEvent = timeline.data.data.events.find(
    (event) => event.type === 'INSPECTION_ASSIGNED',
  );
  const legacyEvent = timeline.data.data.events.find(
    (event) => event.type === 'PICKUP_ACCEPTED',
  );
  assert(pickupEvent?.commandId, 'Pickup Assignment Event is missing commandId');
  assert(
    pickupEvent.schemaVersion === 1 &&
      pickupEvent.commandSequence === 1 &&
      pickupEvent.previousStatus === 'CASE_CREATED' &&
      pickupEvent.nextStatus === 'PICKUP_ASSIGNED' &&
      pickupEvent.nextVersion === pickupEvent.previousVersion + 1 &&
      pickupEvent.occurredAt &&
      pickupEvent.recordedAt,
    'Pickup Assignment Event is missing audit transition boundaries',
  );
  assert(
    inspectionEvent?.commandId === normal.headers['x-command-id'] &&
      inspectionEvent.schemaVersion === 1 &&
      inspectionEvent.commandSequence === 1 &&
      inspectionEvent.previousStatus === 'FACILITY_RECEIVED' &&
      inspectionEvent.nextStatus === 'INSPECTION_ASSIGNED' &&
      inspectionEvent.nextVersion === inspectionEvent.previousVersion + 1 &&
      inspectionEvent.occurredAt &&
      inspectionEvent.recordedAt,
    'Assign Inspector Event is missing command correlation or transition boundaries',
  );
  assert(
    legacyEvent?.schemaVersion === 1 &&
      !legacyEvent.commandId &&
      legacyEvent.previousStatus === 'PICKUP_ASSIGNED' &&
      legacyEvent.nextStatus === 'PICKUP_ACCEPTED' &&
      legacyEvent.nextVersion === legacyEvent.previousVersion + 1,
    'Legacy transition Event audit fields are missing or unsafe',
  );
  assert(
    timeline.data.data.events.filter((event) => event.type === 'INSPECTION_ASSIGNED').length === 1,
    'Completed replay created a duplicate Event',
  );
  const notifications = await api.get('/api/notifications', {
    headers: headers(inspectorToken),
  });
  assert(
    notifications.data.data.notifications.filter(
      (notification) => notification.caseId === caseA && notification.type === 'INSPECTION_ASSIGNED',
    ).length === 1,
    'Completed replay created a duplicate inspector notification',
  );

  const caseB = await createReadyCase({ customerToken, courierToken, courierId, suffix: 'B' });
  const sameKey = `${keyPrefix}-parallel-same-key`;
  const sameKeyResults = await Promise.all([
    api.post(`/api/inspections/${caseB}/assign`, bodyA, {
      headers: headers(adminToken, sameKey),
    }),
    api.post(`/api/inspections/${caseB}/assign`, bodyA, {
      headers: headers(adminToken, sameKey),
    }),
  ]);
  const sameKeyStatuses = sameKeyResults.map(({ status }) => status).sort();
  assert(
    sameKeyStatuses[0] === 201 && sameKeyStatuses[1] === 409,
    `Concurrent same key expected 201/409, got ${sameKeyStatuses.join('/')}`,
  );
  assert(
    sameKeyResults.find(({ status }) => status === 409).data.code === 'IDEMPOTENCY_IN_PROGRESS',
    'Concurrent same-key request returned the wrong code',
  );

  const caseC = await createReadyCase({ customerToken, courierToken, courierId, suffix: 'C' });
  const differentKeyResults = await Promise.all([
    api.post(`/api/inspections/${caseC}/assign`, bodyA, {
      headers: headers(adminToken, `${keyPrefix}-case-race-one`),
    }),
    api.post(`/api/inspections/${caseC}/assign`, bodyA, {
      headers: headers(adminToken, `${keyPrefix}-case-race-two`),
    }),
  ]);
  const differentKeyStatuses = differentKeyResults.map(({ status }) => status).sort();
  assert(
    differentKeyStatuses[0] === 201 && differentKeyStatuses[1] === 409,
    `Different keys expected 201/409, got ${differentKeyStatuses.join('/')}`,
  );
  assert(
    differentKeyResults.find(({ status }) => status === 409).data.code === 'CASE_MODIFIED',
    'Different-key case race returned the wrong code',
  );

  console.log(JSON.stringify({
    normal: normal.status,
    completedReplay: {
      status: replay.status,
      replayed: replay.headers['idempotency-replayed'],
    },
    changedBody: { status: changed.status, code: changed.data.code },
    concurrentSameKey: sameKeyResults.map(({ status, data }) => ({ status, code: data.code })),
    concurrentDifferentKeys: differentKeyResults.map(({ status, data }) => ({ status, code: data.code })),
    duplicateEventCheck: 'passed',
    duplicateNotificationCheck: 'passed',
    pickupAuditMetadataCheck: 'passed',
    inspectionAuditMetadataCheck: 'passed',
    legacyTransitionAuditMetadataCheck: 'passed',
  }, null, 2));
};

try {
  await run();
} finally {
  if (adminToken) {
    for (const caseId of caseIds) {
      await api.delete(`/api/cases/${caseId}`, { headers: headers(adminToken) });
    }
  }

  const { connectDatabase } = await import('../../src/config/db.js');
  const { CommandExecution } = await import('../../src/models/CommandExecution.js');
  const { Facility } = await import('../../src/models/Facility.js');
  if (mongoose.connection.readyState === 0) await connectDatabase();
  await CommandExecution.deleteMany({ key: { $regex: `^${keyPrefix}` } });
  if (facilityId) await Facility.deleteOne({ _id: facilityId });
  await mongoose.connection.close();
}
