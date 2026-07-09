import { CASE_STATUSES } from '../../constants/caseStatus.js';
import { INSPECTION_STATUSES } from '../../constants/inspectionStatus.js';
import { PICKUP_STATUSES } from '../../constants/pickupStatus.js';
import { Event } from '../../models/Event.js';
import { Inspection } from '../../models/Inspection.js';
import { LedgerEntry } from '../../models/LedgerEntry.js';
import { Notification } from '../../models/Notification.js';
import { Pickup } from '../../models/Pickup.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';

const RECENT_LIMIT = 10;
const INSPECTOR_SECONDARY_QUEUE_LIMIT = 5;
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
      RecoveryCase.find(customerFilter)
        .select('_id caseCode requestType status createdAt updatedAt product.name')
        .sort({ createdAt: -1 })
        .limit(RECENT_LIMIT)
        .lean(),
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
  const activePickupFilter = {
    ...courierFilter,
    status: {
      $in: [
        PICKUP_STATUSES.ASSIGNED,
        PICKUP_STATUSES.ACCEPTED,
        PICKUP_STATUSES.COLLECTED,
      ],
    },
  };
  const [assignedPickups, acceptedPickups, collectedPickups, recentPickups, activePickups] =
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
        .limit(RECENT_LIMIT)
        .lean(),
      Pickup.find(activePickupFilter)
        .select(
          '_id caseId facilityId pickupAddress status scheduledWindow acceptedAt collectedAt createdAt updatedAt',
        )
        .populate('facilityId', 'name type location')
        .sort({ createdAt: -1, _id: -1 })
        .limit(RECENT_LIMIT)
        .lean(),
    ]);

  return {
    assignedPickups,
    acceptedPickups,
    collectedPickups,
    recentPickups,
    activePickups,
  };
};

export const getInspectorDashboard = async (inspectorId) => {
  const inspectorFilter = { inspectorId };
  const activeInspectionFilter = {
    ...inspectorFilter,
    status: { $in: [INSPECTION_STATUSES.ASSIGNED, INSPECTION_STATUSES.IN_PROGRESS] },
  };
  const completedInspectionFilter = {
    ...inspectorFilter,
    status: INSPECTION_STATUSES.COMPLETED,
  };
  const now = new Date();
  const startOfTodayUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  const startOfTomorrowUtc = new Date(startOfTodayUtc);
  startOfTomorrowUtc.setUTCDate(startOfTomorrowUtc.getUTCDate() + 1);

  const inspectionListFields =
    '_id caseId inspectorId facilityId status assignedAt startedAt completedAt condition recommendedOutcome createdAt updatedAt';
  const caseListFields =
    'caseCode status requestType product.name product.category product.serialNumber pickupAddress assignedFacilityId';
  const facilityListFields = 'name type location.city location.state location.pincode';

  const toDashboardInspection = (inspection) => ({
    ...inspection,
    recoveryCase: inspection.caseId,
  });

  const [
    pendingInspections,
    completedInspections,
    recentInspections,
    assignedToday,
    assignedInspectionQueue,
    pendingReviewInspections,
    awaitingReceiptCases,
  ] =
    await Promise.all([
      Inspection.countDocuments(activeInspectionFilter),
      Inspection.countDocuments(completedInspectionFilter),
      Inspection.find(inspectorFilter).sort({ createdAt: -1 }).limit(RECENT_LIMIT).lean(),
      Inspection.countDocuments({
        ...inspectorFilter,
        assignedAt: { $gte: startOfTodayUtc, $lt: startOfTomorrowUtc },
      }),
      Inspection.find(activeInspectionFilter)
        .select(inspectionListFields)
        .populate('caseId', caseListFields)
        .populate('facilityId', facilityListFields)
        .sort({ assignedAt: -1, _id: -1 })
        .limit(RECENT_LIMIT)
        .lean(),
      Inspection.aggregate([
        { $match: completedInspectionFilter },
        {
          $lookup: {
            from: RecoveryCase.collection.name,
            let: { caseId: '$caseId', inspectionId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$caseId'] },
                      { $eq: ['$inspectionId', '$$inspectionId'] },
                      { $eq: ['$status', CASE_STATUSES.INSPECTION_COMPLETED] },
                    ],
                  },
                },
              },
              {
                $project: {
                  caseCode: 1,
                  status: 1,
                  requestType: 1,
                  product: 1,
                  pickupAddress: 1,
                  assignedFacilityId: 1,
                },
              },
            ],
            as: 'case',
          },
        },
        { $unwind: '$case' },
        { $sort: { completedAt: -1, _id: -1 } },
        { $limit: INSPECTOR_SECONDARY_QUEUE_LIMIT },
        {
          $lookup: {
            from: 'facilities',
            localField: 'facilityId',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1, type: 1, location: 1 } }],
            as: 'facility',
          },
        },
        {
          $project: {
            caseId: '$case',
            recoveryCase: '$case',
            inspectorId: 1,
            facilityId: { $arrayElemAt: ['$facility', 0] },
            status: 1,
            assignedAt: 1,
            startedAt: 1,
            completedAt: 1,
            condition: 1,
            recommendedOutcome: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]),
      RecoveryCase.find({ status: CASE_STATUSES.DELIVERED_TO_FACILITY })
        .select('_id caseCode product.name requestType status assignedFacilityId createdAt updatedAt')
        .sort({ updatedAt: 1, _id: 1 })
        .limit(RECENT_LIMIT)
        .lean(),
    ]);

  const pendingReviewIds = pendingReviewInspections.map(({ _id }) => _id);
  const recentlyCompletedInspections = await Inspection.find({
    ...completedInspectionFilter,
    _id: { $nin: pendingReviewIds },
  })
    .select(inspectionListFields)
    .populate('caseId', caseListFields)
    .populate('facilityId', facilityListFields)
    .sort({ completedAt: -1, _id: -1 })
    .limit(INSPECTOR_SECONDARY_QUEUE_LIMIT)
    .lean();

  return {
    pendingInspections,
    completedInspections,
    recentInspections,
    assignedToday,
    assignedInspectionQueue: assignedInspectionQueue.map(toDashboardInspection),
    pendingReviewInspections,
    recentlyCompletedInspections: recentlyCompletedInspections.map(toDashboardInspection),
    awaitingReceiptCases,
  };
};

export const getAdminDashboard = async (adminId) => {
  const [
    totalCases,
    activeCases,
    completedCases,
    pendingDecisions,
    refundPendingCases,
    refundTotals,
    recentCases,
    recentEvents,
    pendingDecisionCases,
    unreadNotificationsPreview,
    unreadNotificationsCount,
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
    RecoveryCase.find()
      .select('_id caseCode requestType status createdAt updatedAt product.name')
      .sort({ createdAt: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
    Event.find()
      .select('_id caseId type actorRole metadata createdAt occurredAt')
      .sort({ createdAt: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
    RecoveryCase.find({ status: CASE_STATUSES.DECISION_PENDING })
      .select('_id caseCode product.name status createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
    Notification.find({ userId: adminId, isRead: false })
      .select('_id caseId type title message isRead createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .lean(),
    Notification.countDocuments({ userId: adminId, isRead: false }),
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
    pendingDecisionCases,
    unreadNotificationsPreview,
    unreadNotificationsCount,
  };
};
