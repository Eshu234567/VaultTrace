const {
  FoundItem,
  Claim,
  MatchCandidate,
  ItemEvent,
  AuditLog,
  Notification,
  User,
} = require('../models');

const DEFAULT_RETENTION_DAYS = {
  'Small / Low-Value': 30,
  Standard: 90,
  'High-Value / Sensitive': 180,
  'Perishable / Unsafe': 2,
};

function computeEligibilityDate(foundAt, retentionClass, customDays) {
  const days =
    typeof customDays === 'number' && !Number.isNaN(customDays)
      ? customDays
      : DEFAULT_RETENTION_DAYS[retentionClass] ?? 90;
  const baseDate = foundAt ? new Date(foundAt) : new Date();
  return {
    retentionDays: days,
    eligibleForDisposalAt: new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000),
  };
}

/**
 * Scans Stored items whose eligibleForDisposalAt has passed.
 * Respects Claim Freeze: Any item with an active/pending claim or high-confidence unresolved match is frozen.
 * Never hard-deletes MongoDB records!
 */
async function runRetentionEligibilityScan(actorId = null) {
  const now = new Date();
  let systemAdminId = actorId;

  if (!systemAdminId) {
    const adminUser = await User.findOne({ role: 'admin' }).select('_id');
    if (adminUser) systemAdminId = adminUser._id;
  }

  const overdueItems = await FoundItem.find({
    status: 'Stored',
    eligibleForDisposalAt: { $lte: now },
  });

  const transitioned = [];
  const frozen = [];

  for (const item of overdueItems) {
    // Check for active claims
    const activeClaimsCount = await Claim.countDocuments({
      foundItemId: item._id,
      status: { $in: ['Pending', 'More Information Required', 'Approved'] },
    });

    // Check for active high-confidence matches
    const highMatchCount = await MatchCandidate.countDocuments({
      foundItemId: item._id,
      score: { $gte: 75 },
      state: { $in: ['Suggested', 'Claim Initiated'] },
    });

    if (activeClaimsCount > 0 || highMatchCount > 0 || item.claimFreeze) {
      item.claimFreeze = true;
      await item.save();
      frozen.push({
        itemCode: item.itemCode,
        itemName: item.itemName,
        reason: activeClaimsCount > 0 ? 'Active Claim Pending' : 'High-Confidence Match Active',
      });
      continue;
    }

    const previousStatus = item.status;
    item.status = 'Disposal Review';
    await item.save();

    if (systemAdminId) {
      await ItemEvent.create({
        foundItemId: item._id,
        actorId: systemAdminId,
        eventType: 'RETENTION_REVIEW_FLAGGED',
        fromStatus: previousStatus,
        toStatus: 'Disposal Review',
        note: `Retention window (${item.retentionDays}d for ${item.retentionClass}) elapsed. Moved to Disposal Review queue.`,
      });

      await AuditLog.create({
        actorId: systemAdminId,
        actorRole: 'admin',
        action: 'RETENTION_ELIGIBILITY_SCAN_FLAGGED',
        entityType: 'FoundItem',
        entityId: item._id,
        beforeSummary: { status: previousStatus },
        afterSummary: {
          status: 'Disposal Review',
          retentionClass: item.retentionClass,
          eligibleForDisposalAt: item.eligibleForDisposalAt,
        },
      });

      await Notification.create({
        recipientId: systemAdminId,
        type: 'RETENTION_ALERT',
        title: `Retention Review Due: ${item.itemCode} (${item.itemName})`,
        message: `Item ${item.itemCode} (${item.retentionClass}) has passed its ${item.retentionDays}-day retention window and is now in Disposal Review.`,
        relatedEntityType: 'FoundItem',
        relatedEntityId: item._id,
        dedupeKey: `RETENTION_DUE_${item._id}`,
      });
    }

    transitioned.push({
      _id: item._id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      retentionClass: item.retentionClass,
    });
  }

  return {
    scannedAt: now,
    overdueFound: overdueItems.length,
    movedToDisposalReview: transitioned.length,
    frozenByActiveClaimOrMatch: frozen.length,
    transitionedItems: transitioned,
    frozenItems: frozen,
  };
}

/**
 * Evaluator Time-Travel Simulator:
 * Fast-forwards an item's age by shifting `foundAt` and `eligibleForDisposalAt` back by `daysToAge` days,
 * then runs the eligibility scan so evaluators can watch the retention lifecycle live.
 */
async function simulateTimeTravelForItems({ itemIds = [], daysToFastForward = 45, actorId }) {
  const shiftMs = daysToFastForward * 24 * 60 * 60 * 1000;
  const query = itemIds.length > 0 ? { _id: { $in: itemIds } } : { status: 'Stored', retentionClass: 'Small / Low-Value' };

  const items = await FoundItem.find(query);
  for (const item of items) {
    const oldFoundAt = item.foundAt;
    const oldEligible = item.eligibleForDisposalAt;
    item.foundAt = new Date(new Date(item.foundAt).getTime() - shiftMs);
    item.eligibleForDisposalAt = new Date(new Date(item.eligibleForDisposalAt).getTime() - shiftMs);
    await item.save();

    if (actorId) {
      await ItemEvent.create({
        foundItemId: item._id,
        actorId,
        eventType: 'TIME_TRAVEL_SIMULATED',
        fromStatus: item.status,
        toStatus: item.status,
        note: `Simulated +${daysToFastForward} days ageing for DBMS retention demonstration.`,
      });

      await AuditLog.create({
        actorId,
        actorRole: 'admin',
        action: 'TIME_TRAVEL_RETENTION_SIMULATION',
        entityType: 'FoundItem',
        entityId: item._id,
        beforeSummary: { foundAt: oldFoundAt, eligibleForDisposalAt: oldEligible },
        afterSummary: { foundAt: item.foundAt, eligibleForDisposalAt: item.eligibleForDisposalAt, daysSimulated: daysToFastForward },
      });
    }
  }

  const scanResult = await runRetentionEligibilityScan(actorId);
  return {
    agedCount: items.length,
    daysSimulated: daysToFastForward,
    scanResult,
  };
}

module.exports = {
  DEFAULT_RETENTION_DAYS,
  computeEligibilityDate,
  runRetentionEligibilityScan,
  simulateTimeTravelForItems,
};
