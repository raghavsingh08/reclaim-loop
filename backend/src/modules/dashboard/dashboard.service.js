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
  const needsPickupFilter = { status: CASE_STATUSES.CASE_CREATED };
  const needsFacilityReceiptFilter = { status: CASE_STATUSES.DELIVERED_TO_FACILITY };
  const needsInspectorFilter = {
    status: { $in: [CASE_STATUSES.FACILITY_RECEIVED, CASE_STATUSES.REINSPECTION_REQUESTED] },
  };
  const pendingDecisionFilter = {
    status: { $in: [CASE_STATUSES.DECISION_PENDING, CASE_STATUSES.INSPECTION_COMPLETED] },
  };
  const pendingRefundFilter = {
    status: {
      $in: [
        CASE_STATUSES.REFUND_REVIEW_PENDING,
        CASE_STATUSES.REFUND_PENDING,
        CASE_STATUSES.REFUND_APPROVED,
      ],
    },
  };
  const activeCasesFilter = { status: { $nin: TERMINAL_CASE_STATUSES } };
  const completedCasesFilter = { status: CASE_STATUSES.CASE_COMPLETED };

  const selectFields = '_id caseCode product.name requestType status createdAt updatedAt';

  const [
    totalCases,
    activeCasesCount,
    completedCasesCount,
    pendingDecisionsCount,
    refundPendingCasesCount,
    refundTotals,
    recentEvents,
    unreadNotificationsPreview,
    unreadNotificationsCount,
    needsPickupItems,
    needsPickupCount,
    needsFacilityReceiptItems,
    needsFacilityReceiptCount,
    needsInspectorItems,
    needsInspectorCount,
    pendingDecisionItems,
    pendingDecisionCount,
    pendingRefundItems,
    pendingRefundCount,
    activeCaseItems,
    recentlyCompletedItems,
  ] = await Promise.all([
    RecoveryCase.countDocuments(),
    RecoveryCase.countDocuments(activeCasesFilter),
    RecoveryCase.countDocuments(completedCasesFilter),
    RecoveryCase.countDocuments(pendingDecisionFilter),
    RecoveryCase.countDocuments(pendingRefundFilter),
    LedgerEntry.aggregate([
      { $match: { type: 'REFUND_OBLIGATION' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Event.find()
      .select('_id caseId type actorRole metadata createdAt occurredAt')
      .sort({ createdAt: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
    Notification.find({ userId: adminId, isRead: false })
      .select('_id caseId type title message isRead createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .lean(),
    Notification.countDocuments({ userId: adminId, isRead: false }),

    // 1. Needs Pickup Assignment
    RecoveryCase.find(needsPickupFilter)
      .select(selectFields)
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
    RecoveryCase.countDocuments(needsPickupFilter),

    // 2. Needs Facility Receipt
    RecoveryCase.find(needsFacilityReceiptFilter)
      .select(selectFields)
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
    RecoveryCase.countDocuments(needsFacilityReceiptFilter),

    // 3. Needs Inspector Assignment
    RecoveryCase.find(needsInspectorFilter)
      .select(selectFields)
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
    RecoveryCase.countDocuments(needsInspectorFilter),

    // 4. Pending Decisions
    RecoveryCase.find(pendingDecisionFilter)
      .select(selectFields)
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
    RecoveryCase.countDocuments(pendingDecisionFilter),

    // 5. Pending Refunds
    RecoveryCase.find(pendingRefundFilter)
      .select(selectFields)
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_LIMIT)
      .lean(),
    RecoveryCase.countDocuments(pendingRefundFilter),

    // 6. Active Recovery Cases (preview up to 10)
    RecoveryCase.find(activeCasesFilter)
      .select(selectFields)
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_LIMIT)
      .lean(),

    // 7. Recently Completed Cases (preview up to 5, sorted by updatedAt desc)
    RecoveryCase.find(completedCasesFilter)
      .select(selectFields)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(5)
      .lean(),
  ]);

  return {
    totalCases,
    activeCases: {
      items: activeCaseItems,
      totalCount: activeCasesCount,
    },
    completedCases: completedCasesCount,
    pendingDecisions: pendingDecisionsCount,
    refundPendingCases: refundPendingCasesCount,
    totalRefundObligations: refundTotals[0]?.total || 0,
    recentCases: activeCaseItems,
    recentEvents,
    pendingDecisionCases: {
      items: pendingDecisionItems,
      totalCount: pendingDecisionCount,
    },
    needsPickupCases: {
      items: needsPickupItems,
      totalCount: needsPickupCount,
    },
    needsFacilityReceiptCases: {
      items: needsFacilityReceiptItems,
      totalCount: needsFacilityReceiptCount,
    },
    needsInspectorCases: {
      items: needsInspectorItems,
      totalCount: needsInspectorCount,
    },
    pendingRefundCases: {
      items: pendingRefundItems,
      totalCount: pendingRefundCount,
    },
    recentlyCompletedCases: {
      items: recentlyCompletedItems,
      totalCount: completedCasesCount,
    },
    unreadNotificationsPreview,
    unreadNotificationsCount,
  };
};
