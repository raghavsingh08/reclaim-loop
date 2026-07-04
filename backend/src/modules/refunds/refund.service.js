import mongoose from 'mongoose';
import { CASE_STATUSES } from '../../constants/caseStatus.js';
import { CaseEngine } from '../../domain/caseEngine.js';
import { EventPublisher } from '../../domain/eventPublisher.js';
import { Event } from '../../models/Event.js';
import { LedgerEntry } from '../../models/LedgerEntry.js';
import { RecoveryCase } from '../../models/RecoveryCase.js';
import { ApiError } from '../../utils/ApiError.js';
import { createNotification } from '../notifications/notification.service.js';

const REFUND_OBLIGATION = 'REFUND_OBLIGATION';

const requireCaseId = (caseId) => {
  if (!mongoose.isValidObjectId(caseId)) throw new ApiError(400, 'Invalid case ID');
};

export const approveRefund = async (caseId, { amount, reason }, actor) => {
  requireCaseId(caseId);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Amount must be a positive number');
  }
  if (!reason?.trim()) throw new ApiError(400, 'Reason is required');

  let updatedCase;
  await CaseEngine.runInTransaction(async (session) => {
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');

      updatedCase = await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.REFUND_APPROVED,
        actorId: actor._id,
        actorRole: actor.role,
        metadata: { amount, reason: reason.trim() },
      });
  });
  await createNotification({
      userId: updatedCase.customerId,
      caseId: updatedCase._id,
      type: CASE_STATUSES.REFUND_APPROVED,
      title: 'Refund approved',
      message: 'Your refund request was approved.',
      metadata: { amount, reason: reason.trim() },
  });
  EventPublisher.publishRefundApproved({
      caseId: updatedCase._id.toString(),
      amount,
      reason: reason.trim(),
      actorId: actor._id.toString(),
      actorRole: actor.role,
      timestamp: new Date().toISOString(),
  });
  return updatedCase;
};

export const recordRefund = async (
  caseId,
  { currency = 'INR', debitAccount, creditAccount },
  actor,
) => {
  requireCaseId(caseId);
  if (!debitAccount?.trim() || !creditAccount?.trim()) {
    throw new ApiError(400, 'Debit account and credit account are required');
  }
  if (typeof currency !== 'string' || !currency.trim()) {
    throw new ApiError(400, 'Currency must be a non-empty string');
  }

  let ledgerEntry;
  let updatedCase;
  await CaseEngine.runInTransaction(async (session) => {
      const recoveryCase = await RecoveryCase.findById(caseId).session(session);
      if (!recoveryCase) throw new ApiError(404, 'Recovery case not found');

      const existingEntry = await LedgerEntry.findOne({
        caseId: recoveryCase._id,
        type: REFUND_OBLIGATION,
      }).session(session);
      if (existingEntry) throw new ApiError(409, 'Refund obligation is already recorded');

      const approvalEvent = await Event.findOne({
        caseId: recoveryCase._id,
        type: CASE_STATUSES.REFUND_APPROVED,
      })
        .sort({ createdAt: -1 })
        .session(session);
      const approvedAmount = approvalEvent?.metadata?.amount;
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
        throw new ApiError(409, 'Refund approval amount is unavailable');
      }

      [ledgerEntry] = await LedgerEntry.create(
        [{
          caseId: recoveryCase._id,
          type: REFUND_OBLIGATION,
          amount: approvedAmount,
          currency: currency.trim().toUpperCase(),
          debitAccount: debitAccount.trim(),
          creditAccount: creditAccount.trim(),
          createdBy: actor._id,
        }],
        { session },
      );

      await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.REFUND_RECORDED,
        actorId: actor._id,
        actorRole: actor.role,
        metadata: { ledgerEntryId: ledgerEntry._id, amount: approvedAmount },
      });
      updatedCase = await CaseEngine.transition({
        session,
        recoveryCase,
        toStatus: CASE_STATUSES.CASE_COMPLETED,
        actorId: actor._id,
        actorRole: actor.role,
        metadata: { ledgerEntryId: ledgerEntry._id },
      });
  });
  await createNotification({
      userId: updatedCase.customerId,
      caseId: updatedCase._id,
      type: CASE_STATUSES.REFUND_RECORDED,
      title: 'Refund recorded and case completed',
      message: 'Your refund obligation was recorded and the recovery case was completed.',
      metadata: {
        ledgerEntryId: ledgerEntry._id,
        amount: ledgerEntry.amount,
        currency: ledgerEntry.currency,
      },
  });
  EventPublisher.publishRefundRecorded({
      caseId: updatedCase._id.toString(),
      ledgerEntryId: ledgerEntry._id.toString(),
      amount: ledgerEntry.amount,
      currency: ledgerEntry.currency,
      actorId: actor._id.toString(),
      actorRole: actor.role,
      timestamp: new Date().toISOString(),
  });
  return { case: updatedCase, ledgerEntry };
};

export const getRefundEntries = async (caseId) => {
  requireCaseId(caseId);
  if (!(await RecoveryCase.exists({ _id: caseId }))) {
    throw new ApiError(404, 'Recovery case not found');
  }
  return LedgerEntry.find({ caseId, type: REFUND_OBLIGATION }).sort({ createdAt: -1 });
};
