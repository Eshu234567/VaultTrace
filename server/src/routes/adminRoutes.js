const express = require('express');
const {
  Claim,
  FoundItem,
  LostReport,
  MatchCandidate,
  ItemEvent,
  DisposalRecord,
  AuditLog,
  Notification,
  CampusLocation,
} = require('../models');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const {
  runRetentionEligibilityScan,
  simulateTimeTravelForItems,
} = require('../services/retentionService');
const { runFullReconciliation } = require('../services/matchingService');

const router = express.Router();

// GET /api/admin/claims — Admin/Staff claim review queue with full restricted proof comparison
router.get(
  '/claims',
  authenticate,
  authorizeRoles('admin', 'staff'),
  async (req, res, next) => {
    try {
      const { status } = req.query;
      const filter = {};
      if (status && status !== 'All') filter.status = status;

      const claims = await Claim.find(filter)
        .populate('claimantId', 'name email role department identifierCode phone')
        .populate('foundItemId')
        .populate('lostReportId')
        .populate('reviewedBy', 'name email identifierCode')
        .sort({ submittedAt: -1 })
        .lean();

      return res.json({ success: true, data: claims });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/admin/claims/:id — Controlled claim moderation (Approve, Reject, More Info)
// Enforces single active approved claim per item!
router.patch(
  '/claims/:id',
  authenticate,
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const { status, reviewNotesPrivate, adminFeedbackToClaimant } = req.body;
      if (!['Approved', 'Rejected', 'More Information Required'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'status must be Approved, Rejected, or More Information Required.',
        });
      }

      const claim = await Claim.findById(req.params.id);
      if (!claim) {
        return res.status(404).json({ success: false, error: 'Claim not found.' });
      }

      const foundItem = await FoundItem.findById(claim.foundItemId);
      if (!foundItem) {
        return res.status(404).json({ success: false, error: 'Associated found item not found.' });
      }

      const beforeClaimStatus = claim.status;
      const beforeItemStatus = foundItem.status;

      if (status === 'Approved') {
        // Business Rule: Verify no other active Approved or Handed Over claim exists for this foundItem
        const competingApproved = await Claim.findOne({
          _id: { $ne: claim._id },
          foundItemId: foundItem._id,
          status: { $in: ['Approved', 'Handed Over'] },
        });

        if (competingApproved) {
          return res.status(409).json({
            success: false,
            error: `Integrity Constraint Violation: Found item ${foundItem.itemCode} already has an approved claim (${competingApproved.claimCode}). Cannot approve two competing claims for the same physical item.`,
          });
        }

        if (!['Stored', 'Claim Pending'].includes(foundItem.status)) {
          return res.status(409).json({
            success: false,
            error: `Cannot approve claim because item ${foundItem.itemCode} is currently in state '${foundItem.status}'.`,
          });
        }

        claim.status = 'Approved';
        claim.reviewedBy = req.user._id;
        claim.decidedAt = new Date();
        claim.handoverPassCode = `HND-PASS-${claim.claimCode.split('-').pop()}`;
        if (reviewNotesPrivate !== undefined) claim.reviewNotesPrivate = reviewNotesPrivate;
        claim.adminFeedbackToClaimant =
          adminFeedbackToClaimant ||
          `Approved! Present handover pass ${claim.handoverPassCode} and your Campus ID at ${foundItem.storageLocation}.`;

        await claim.save();

        foundItem.status = 'Approved';
        foundItem.claimFreeze = true;
        await foundItem.save();

        if (claim.lostReportId) {
          await MatchCandidate.findOneAndUpdate(
            { lostReportId: claim.lostReportId, foundItemId: foundItem._id },
            { state: 'Confirmed Match', reviewedAt: new Date() }
          );
        }

        await ItemEvent.create({
          foundItemId: foundItem._id,
          actorId: req.user._id,
          eventType: 'CLAIM_APPROVED',
          fromStatus: beforeItemStatus,
          toStatus: 'Approved',
          note: `Claim ${claim.claimCode} approved by ${req.user.name}. Handover pass ${claim.handoverPassCode} issued.`,
        });

        await Notification.create({
          recipientId: claim.claimantId,
          type: 'CLAIM_APPROVED',
          title: `Claim Approved! Collect ${foundItem.itemName} (${foundItem.itemCode})`,
          message: claim.adminFeedbackToClaimant,
          relatedEntityType: 'Claim',
          relatedEntityId: claim._id,
        });
      } else if (status === 'Rejected') {
        claim.status = 'Rejected';
        claim.reviewedBy = req.user._id;
        claim.decidedAt = new Date();
        if (reviewNotesPrivate !== undefined) claim.reviewNotesPrivate = reviewNotesPrivate;
        claim.adminFeedbackToClaimant =
          adminFeedbackToClaimant ||
          'Your ownership proof did not match the restricted verification record for this item.';
        await claim.save();

        // Check if other pending claims exist for this item; if none, revert item to Stored
        const otherPending = await Claim.countDocuments({
          _id: { $ne: claim._id },
          foundItemId: foundItem._id,
          status: { $in: ['Pending', 'More Information Required', 'Approved'] },
        });

        if (otherPending === 0 && foundItem.status === 'Claim Pending') {
          foundItem.status = 'Stored';
          foundItem.claimFreeze = false;
          await foundItem.save();
        }

        if (claim.lostReportId) {
          await LostReport.findByIdAndUpdate(claim.lostReportId, { status: 'Possible Match' });
        }

        await ItemEvent.create({
          foundItemId: foundItem._id,
          actorId: req.user._id,
          eventType: 'CLAIM_REJECTED',
          fromStatus: beforeItemStatus,
          toStatus: foundItem.status,
          note: `Claim ${claim.claimCode} rejected by ${req.user.name}. Reason: ${claim.adminFeedbackToClaimant}`,
        });

        await Notification.create({
          recipientId: claim.claimantId,
          type: 'CLAIM_REJECTED',
          title: `Claim Update: ${claim.claimCode} Not Approved`,
          message: claim.adminFeedbackToClaimant,
          relatedEntityType: 'Claim',
          relatedEntityId: claim._id,
        });
      } else if (status === 'More Information Required') {
        claim.status = 'More Information Required';
        claim.reviewedBy = req.user._id;
        if (reviewNotesPrivate !== undefined) claim.reviewNotesPrivate = reviewNotesPrivate;
        claim.adminFeedbackToClaimant =
          adminFeedbackToClaimant ||
          'Please provide additional identifying details (e.g., exact contents, sticker, or serial digits) to verify ownership.';
        await claim.save();

        await Notification.create({
          recipientId: claim.claimantId,
          type: 'CLAIM_MORE_INFO',
          title: `Additional Proof Requested for Claim ${claim.claimCode}`,
          message: claim.adminFeedbackToClaimant,
          relatedEntityType: 'Claim',
          relatedEntityId: claim._id,
        });
      }

      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: `CLAIM_DECISION_${status.toUpperCase().replace(/\s+/g, '_')}`,
        entityType: 'Claim',
        entityId: claim._id,
        beforeSummary: { claimStatus: beforeClaimStatus, itemStatus: beforeItemStatus },
        afterSummary: { claimStatus: claim.status, itemStatus: foundItem.status },
      });

      const populated = await Claim.findById(claim._id)
        .populate('claimantId', 'name email department identifierCode')
        .populate('foundItemId')
        .populate('lostReportId');

      return res.json({ success: true, data: populated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/claims/:id/handover — Record physical custody handover to recipient
router.post(
  '/claims/:id/handover',
  authenticate,
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const { recipientName, recipientIdentifier, handoverCondition, handoverNotes } = req.body;
      const claim = await Claim.findById(req.params.id).populate('claimantId', 'name identifierCode');
      if (!claim) {
        return res.status(404).json({ success: false, error: 'Claim not found.' });
      }

      if (claim.status !== 'Approved') {
        return res.status(409).json({
          success: false,
          error: `Claim must be in 'Approved' state before physical handover (current: '${claim.status}').`,
        });
      }

      const foundItem = await FoundItem.findById(claim.foundItemId);
      if (!foundItem) {
        return res.status(404).json({ success: false, error: 'Found item not found.' });
      }

      const beforeItemStatus = foundItem.status;
      const now = new Date();

      claim.status = 'Handed Over';
      await claim.save();

      foundItem.status = 'Returned';
      foundItem.returnedAt = now;
      foundItem.claimFreeze = false;
      foundItem.handoverDetails = {
        recipientName: recipientName || claim.claimantId?.name || 'Verified Claimant',
        recipientIdentifier: recipientIdentifier || claim.claimantId?.identifierCode || 'ID Verified',
        verifiedByAdminId: req.user._id,
        handoverCondition: handoverCondition || 'Good / Verified Intact',
        handoverNotes: handoverNotes || 'Handed over at Campus Vault after checking ID card.',
        handedOverAt: now,
      };
      await foundItem.save();

      if (claim.lostReportId) {
        await LostReport.findByIdAndUpdate(claim.lostReportId, {
          status: 'Resolved',
          matchedFoundItemId: foundItem._id,
        });
      }

      await ItemEvent.create({
        foundItemId: foundItem._id,
        actorId: req.user._id,
        eventType: 'HANDOVER_COMPLETED',
        fromStatus: beforeItemStatus,
        toStatus: 'Returned',
        note: `Physical item handed over to ${foundItem.handoverDetails.recipientName} (${foundItem.handoverDetails.recipientIdentifier}). Condition: ${foundItem.handoverDetails.handoverCondition}.`,
      });

      await Notification.create({
        recipientId: claim.claimantId._id || claim.claimantId,
        type: 'ITEM_HANDED_OVER',
        title: `Handover Complete: ${foundItem.itemName} (${foundItem.itemCode})`,
        message: `Your item ${foundItem.itemCode} has been marked as Returned at ${now.toLocaleString()}. Thank you for using VaultTrace!`,
        relatedEntityType: 'FoundItem',
        relatedEntityId: foundItem._id,
      });

      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'PHYSICAL_HANDOVER_COMPLETED',
        entityType: 'FoundItem',
        entityId: foundItem._id,
        beforeSummary: { status: beforeItemStatus, claimStatus: 'Approved' },
        afterSummary: {
          status: 'Returned',
          claimStatus: 'Handed Over',
          recipient: foundItem.handoverDetails.recipientIdentifier,
        },
      });

      return res.json({
        success: true,
        data: { claim, foundItem },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/admin/found-items/:id/status — Controlled status, storage bin, or restricted proof update
router.patch(
  '/found-items/:id/status',
  authenticate,
  authorizeRoles('admin', 'staff'),
  async (req, res, next) => {
    try {
      const item = await FoundItem.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ success: false, error: 'Found item not found.' });
      }

      const { status, storageLocation, restrictedProof, note } = req.body;

      // Only admin can edit restrictedProof or authorize disposal states
      if (restrictedProof && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only administrators can modify restricted verification proof.',
        });
      }

      const prevStatus = item.status;
      const prevStorage = item.storageLocation;

      if (status) item.status = status;
      if (storageLocation) item.storageLocation = storageLocation;
      if (restrictedProof && req.user.role === 'admin') {
        item.restrictedProof = { ...item.restrictedProof.toObject(), ...restrictedProof };
      }

      await item.save();

      await ItemEvent.create({
        foundItemId: item._id,
        actorId: req.user._id,
        eventType: storageLocation && storageLocation !== prevStorage ? 'STORAGE_MOVED' : 'INTAKE_STORED',
        fromStatus: prevStatus,
        toStatus: item.status,
        note: note || `Updated status to '${item.status}' / bin '${item.storageLocation}'.`,
      });

      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'FOUND_ITEM_ADMIN_UPDATE',
        entityType: 'FoundItem',
        entityId: item._id,
        beforeSummary: { status: prevStatus, storageLocation: prevStorage },
        afterSummary: { status: item.status, storageLocation: item.storageLocation },
      });

      return res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/matches — Side-by-side Match Candidate review queue
router.get(
  '/matches',
  authenticate,
  authorizeRoles('admin', 'staff'),
  async (req, res, next) => {
    try {
      const matches = await MatchCandidate.find()
        .populate({
          path: 'lostReportId',
          populate: { path: 'reporterId', select: 'name email department identifierCode' },
        })
        .populate('foundItemId')
        .sort({ score: -1, updatedAt: -1 })
        .limit(60)
        .lean();

      return res.json({ success: true, data: matches.filter((m) => m.lostReportId && m.foundItemId) });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/matches/reconcile — Trigger full matching reconciliation job
router.post(
  '/matches/reconcile',
  authenticate,
  authorizeRoles('admin', 'staff'),
  async (req, res, next) => {
    try {
      const summary = await runFullReconciliation();
      return res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/retention/due — List items in Disposal Review, due within 7 days, and past disposal records
router.get(
  '/retention/due',
  authenticate,
  authorizeRoles('admin', 'staff'),
  async (req, res, next) => {
    try {
      const now = new Date();
      const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [disposalReviewQueue, dueSoonItems, stationeryBatches, disposalHistory] = await Promise.all([
        FoundItem.find({ status: 'Disposal Review' }).sort({ eligibleForDisposalAt: 1 }).lean(),
        FoundItem.find({
          status: 'Stored',
          eligibleForDisposalAt: { $lte: sevenDaysOut },
        })
          .sort({ eligibleForDisposalAt: 1 })
          .lean(),
        FoundItem.find({
          isBatchStationery: true,
          status: { $in: ['Stored', 'Disposal Review', 'Donated', 'Disposed'] },
        })
          .sort({ createdAt: -1 })
          .lean(),
        DisposalRecord.find()
          .populate('approvedBy', 'name email identifierCode')
          .populate('foundItemId', 'itemCode itemName retentionClass batchQuantity')
          .sort({ disposedAt: -1 })
          .lean(),
      ]);

      return res.json({
        success: true,
        data: {
          disposalReviewQueue,
          dueSoonItems,
          stationeryBatches,
          disposalHistory,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/retention/scan — Run daily eligibility scan now
router.post(
  '/retention/scan',
  authenticate,
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const result = await runRetentionEligibilityScan(req.user._id);
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/retention/simulate-time-travel — Fast-forward item age for live viva demo
router.post(
  '/retention/simulate-time-travel',
  authenticate,
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const { itemIds = [], daysToFastForward = 40 } = req.body;
      const result = await simulateTimeTravelForItems({
        itemIds,
        daysToFastForward: Number(daysToFastForward) || 40,
        actorId: req.user._id,
      });
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/disposals — Record approved disposal, donation, or reuse transfer (Never hard-deletes!)
router.post(
  '/disposals',
  authenticate,
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const {
        foundItemId,
        reason,
        disposalMethod,
        organizationOrDept,
        witnessName,
        acknowledgementNote,
      } = req.body;

      if (!foundItemId || !reason || !disposalMethod) {
        return res.status(400).json({
          success: false,
          error: 'foundItemId, reason, and disposalMethod are required.',
        });
      }

      const item = await FoundItem.findById(foundItemId);
      if (!item) {
        return res.status(404).json({ success: false, error: 'Found item not found.' });
      }

      // Check for active claims (Claim Freeze protection)
      const activeClaimCount = await Claim.countDocuments({
        foundItemId: item._id,
        status: { $in: ['Pending', 'More Information Required', 'Approved'] },
      });

      if (activeClaimCount > 0) {
        return res.status(409).json({
          success: false,
          error: `Claim Freeze Active: Item ${item.itemCode} has ${activeClaimCount} unresolved claim(s) and cannot be disposed or donated.`,
        });
      }

      const prevStatus = item.status;
      const isDonationOrReuse =
        disposalMethod.includes('Donate') || disposalMethod.includes('Transfer');
      const newStatus = isDonationOrReuse ? 'Donated' : 'Disposed';

      const count = await DisposalRecord.countDocuments();
      const disposalCode = `DSP-2026-${301 + count + Math.floor(Math.random() * 90)}`;

      const record = await DisposalRecord.create({
        disposalCode,
        foundItemId: item._id,
        itemCodeSnapshot: item.itemCode,
        itemNameSnapshot: item.itemName,
        categorySnapshot: item.category,
        quantityDisposed: item.batchQuantity || 1,
        reason: reason.trim(),
        eligibilityDate: item.eligibleForDisposalAt,
        approvedBy: req.user._id,
        disposalMethod,
        recipientOrWitness: {
          organizationOrDept: organizationOrDept || 'RVCE NSS / Campus Reuse Desk',
          witnessName: witnessName || req.user.name,
          acknowledgementNote: acknowledgementNote || '',
        },
        disposedAt: new Date(),
      });

      item.status = newStatus;
      item.storageLocation = `${newStatus} Archive (${disposalCode})`;
      await item.save();

      await ItemEvent.create({
        foundItemId: item._id,
        actorId: req.user._id,
        eventType: isDonationOrReuse ? 'DONATION_EXECUTED' : 'DISPOSAL_EXECUTED',
        fromStatus: prevStatus,
        toStatus: newStatus,
        note: `${disposalMethod} approved (${disposalCode}). Reason: ${reason}`,
      });

      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: isDonationOrReuse ? 'ITEM_DONATION_APPROVED' : 'ITEM_DISPOSAL_APPROVED',
        entityType: 'DisposalRecord',
        entityId: record._id,
        beforeSummary: { itemCode: item.itemCode, status: prevStatus },
        afterSummary: {
          disposalCode,
          itemCode: item.itemCode,
          status: newStatus,
          disposalMethod,
        },
      });

      return res.status(201).json({
        success: true,
        data: { disposalRecord: record, foundItem: item },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/analytics/overview — Aggregation-backed operational analytics & Campus Zone Heatmap
router.get(
  '/analytics/overview',
  authenticate,
  authorizeRoles('admin', 'staff'),
  async (req, res, next) => {
    try {
      const [
        statusCounts,
        categoryBreakdown,
        retentionClassBreakdown,
        locationHotspots,
        lostLocationHotspots,
        recoveryTimeStats,
        totalLostReports,
        activeLostReports,
        pendingClaims,
        highConfidenceMatches,
        disposalTotals,
        campusLocations,
      ] = await Promise.all([
        // 1. Aggregation: Found items by status
        FoundItem.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 }, totalUnits: { $sum: '$batchQuantity' } } },
          { $sort: { count: -1 } },
        ]),
        // 2. Aggregation: Found items by category
        FoundItem.aggregate([
          {
            $group: {
              _id: '$category',
              totalItems: { $sum: 1 },
              returnedCount: {
                $sum: { $cond: [{ $eq: ['$status', 'Returned'] }, 1, 0] },
              },
              storedCount: {
                $sum: { $cond: [{ $eq: ['$status', 'Stored'] }, 1, 0] },
              },
            },
          },
          { $sort: { totalItems: -1 } },
        ]),
        // 3. Aggregation: Unclaimed items by retentionClass
        FoundItem.aggregate([
          {
            $match: {
              status: { $in: ['Stored', 'Claim Pending', 'Disposal Review'] },
            },
          },
          {
            $group: {
              _id: '$retentionClass',
              itemRecords: { $sum: 1 },
              physicalUnits: { $sum: '$batchQuantity' },
            },
          },
          { $sort: { itemRecords: -1 } },
        ]),
        // 4. Aggregation: Top campus locations for Found Items
        FoundItem.aggregate([
          {
            $group: {
              _id: '$foundLocation',
              buildingZone: { $first: '$foundBuildingZone' },
              foundCount: { $sum: 1 },
            },
          },
          { $sort: { foundCount: -1 } },
        ]),
        // 5. Aggregation: Top campus locations for Lost Reports
        LostReport.aggregate([
          {
            $group: {
              _id: '$lastSeen.location',
              buildingZone: { $first: '$lastSeen.buildingZone' },
              lostCount: { $sum: 1 },
            },
          },
          { $sort: { lostCount: -1 } },
        ]),
        // 6. Aggregation: Average turnaround time from foundAt to returnedAt (in days)
        FoundItem.aggregate([
          { $match: { status: 'Returned', returnedAt: { $ne: null } } },
          {
            $project: {
              itemCode: 1,
              turnaroundDays: {
                $divide: [{ $subtract: ['$returnedAt', '$foundAt'] }, 1000 * 60 * 60 * 24],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgTurnaroundDays: { $avg: '$turnaroundDays' },
              minTurnaroundDays: { $min: '$turnaroundDays' },
              maxTurnaroundDays: { $max: '$turnaroundDays' },
              returnedTotal: { $sum: 1 },
            },
          },
        ]),
        LostReport.countDocuments(),
        LostReport.countDocuments({ status: { $in: ['Active', 'Possible Match', 'Claim Pending'] } }),
        Claim.countDocuments({ status: { $in: ['Pending', 'More Information Required'] } }),
        MatchCandidate.countDocuments({ score: { $gte: 75 } }),
        DisposalRecord.aggregate([
          {
            $group: {
              _id: '$disposalMethod',
              batches: { $sum: 1 },
              totalQuantity: { $sum: '$quantityDisposed' },
            },
          },
        ]),
        CampusLocation.find({ active: true }).lean(),
      ]);

      // Combine Found & Lost counts onto the Campus Zone Heatmap coordinates
      const foundMap = Object.fromEntries(locationHotspots.map((l) => [l._id, l.foundCount]));
      const lostMap = Object.fromEntries(lostLocationHotspots.map((l) => [l._id, l.lostCount]));

      const heatmapZones = campusLocations.map((loc) => ({
        name: loc.name,
        buildingZone: loc.buildingZone,
        storageCode: loc.storageCode,
        defaultVaultBin: loc.defaultVaultBin,
        coordinates: loc.coordinates,
        foundCount: foundMap[loc.name] || 0,
        lostCount: lostMap[loc.name] || 0,
        totalActivity: (foundMap[loc.name] || 0) + (lostMap[loc.name] || 0),
      }));

      const statusMap = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));

      return res.json({
        success: true,
        data: {
          kpis: {
            itemsInStorage: (statusMap['Stored'] || 0) + (statusMap['Claim Pending'] || 0) + (statusMap['Approved'] || 0),
            pendingVerificationTips: statusMap['Pending Verification'] || 0,
            activeLostReports,
            totalLostReports,
            pendingClaims,
            highConfidenceMatches,
            retentionReviewsDue: statusMap['Disposal Review'] || 0,
            itemsReturned: statusMap['Returned'] || 0,
            itemsDonatedOrDisposed: (statusMap['Donated'] || 0) + (statusMap['Disposed'] || 0),
            avgRecoveryDays: recoveryTimeStats[0]
              ? Number(recoveryTimeStats[0].avgTurnaroundDays.toFixed(1))
              : 2.8,
          },
          statusCounts,
          categoryBreakdown,
          retentionClassBreakdown,
          locationHotspots,
          lostLocationHotspots,
          heatmapZones,
          disposalTotals,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/audit-logs — Searchable & filterable Audit Trail
router.get(
  '/audit-logs',
  authenticate,
  authorizeRoles('admin'),
  async (req, res, next) => {
    try {
      const { entityType, action, limit = 60 } = req.query;
      const filter = {};
      if (entityType && entityType !== 'All') filter.entityType = entityType;
      if (action && action.trim()) {
        filter.action = new RegExp(action.trim(), 'i');
      }

      const logs = await AuditLog.find(filter)
        .populate('actorId', 'name email role identifierCode')
        .sort({ timestamp: -1 })
        .limit(Number(limit))
        .lean();

      return res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
