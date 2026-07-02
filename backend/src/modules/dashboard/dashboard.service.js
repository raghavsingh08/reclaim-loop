import { CASE_STATUSES } from '../../constants/caseStatus.js';
import { PICKUP_STATUSES } from '../../constants/pickupStatus.js';
import { Event } from '../../models/Event.js';
import { Inspection } from '../../models/Inspection.js';
import { LedgerEntry } from '../../models/LedgerEntry.js';
import { Notification } from '../../models/Notification.js';
import { Pickup } from '../../models/Pickup.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';

const RECENT_LIMIT = 10;
const TERMINAL_CASE_STATUSES = [
  CASE_STATUSES.CASE_COMPLETED,
  CASE_STATUSES.CANCELLED,
  CASE_STATUSES.REQUEST_REJECTED,
];

export const getCustomerDashboard = async (customerId) => {
  const customerFilter = { customerId };
  const [totalCases, activeCases, completedCases, recentCases, unreadNotificationsCount] =
    await Promise.all([
      RecoveryCase.countDocuments(customerFilter),
      RecoveryCase.countDocuments({
        ...customerFilter,
        status: { $nin: TERMINAL_CASE_STATUSES },
      }),
      RecoveryCase.countDocuments({
        ...customerFilter,
        status: CASE_STATUSES.CASE_COMPLETED,
      }),
      RecoveryCase.find(customerFilter).sort({ createdAt: -1 }).limit(RECENT_LIMIT),
      Notification.countDocuments({ userId: customerId, isRead: false }),
    ]);

  return {
    totalCases,
    activeCases,
    completedCases,
    recentCases,
    unreadNotificationsCount,
  };
};

export const getCourierDashboard = async (courierId) => {
  const courierFilter = { courierId };
  const [assignedPickups, acceptedPickups, collectedPickups, recentPickups] =
    await Promise.all([
      Pickup.countDocuments({ ...courierFilter, status: PICKUP_STATUSES.ASSIGNED }),
      Pickup.countDocuments({ ...courierFilter, status: PICKUP_STATUSES.ACCEPTED }),
      Pickup.countDocuments({
        ...courierFilter,
        status: { $in: [PICKUP_STATUSES.COLLECTED, PICKUP_STATUSES.DELIVERED_TO_FACILITY] },
      }),
      Pickup.find(courierFilter)
        .populate('facilityId', 'name type location')
        .sort({ createdAt: -1 })
        .limit(RECENT_LIMIT),
    ]);

  return {
    assignedPickups,
    acceptedPickups,
    collectedPickups,
    recentPickups,
  };
};

export const getInspectorDashboard = async (inspectorId) => {
  const inspectorFilter = { inspectorId };
  const [pendingInspections, completedInspections, recentInspections] =
    await Promise.all([
      Inspection.countDocuments({ ...inspectorFilter, completedAt: null }),
      Inspection.countDocuments({ ...inspectorFilter, completedAt: { $ne: null } }),
      Inspection.find(inspectorFilter).sort({ createdAt: -1 }).limit(RECENT_LIMIT),
    ]);

  return {
    pendingInspections,
    completedInspections,
    recentInspections,
  };
};

export const getAdminDashboard = async () => {
  const [
    totalCases,
    activeCases,
    completedCases,
    pendingDecisions,
    refundPendingCases,
    refundTotals,
    recentCases,
    recentEvents,
  ] = await Promise.all([
    RecoveryCase.countDocuments(),
    RecoveryCase.countDocuments({ status: { $nin: TERMINAL_CASE_STATUSES } }),
    RecoveryCase.countDocuments({ status: CASE_STATUSES.CASE_COMPLETED }),
    RecoveryCase.countDocuments({ status: CASE_STATUSES.DECISION_PENDING }),
    RecoveryCase.countDocuments({ status: CASE_STATUSES.REFUND_PENDING }),
    LedgerEntry.aggregate([
      { $match: { type: 'REFUND_OBLIGATION' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    RecoveryCase.find().sort({ createdAt: -1 }).limit(RECENT_LIMIT),
    Event.find().sort({ createdAt: -1 }).limit(RECENT_LIMIT),
  ]);

  return {
    totalCases,
    activeCases,
    completedCases,
    pendingDecisions,
    refundPendingCases,
    totalRefundObligations: refundTotals[0]?.total || 0,
    recentCases,
    recentEvents,
  };
};
