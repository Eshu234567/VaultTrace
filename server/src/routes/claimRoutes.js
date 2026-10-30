const express = require('express');
const {
  Claim,
  FoundItem,
  LostReport,
  MatchCandidate,
  ItemEvent,
  Notification,
  AuditLog,
} = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/claims — Submit an ownership verification claim against a found item
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      foundItemId,
      lostReportId = null,
      claimantName = '',
      claimantUsn = '',
      claimAnswers = {},
      proofRefs = [],
    } = req.body;

    const resolvedName = (claimantName || req.user.name || '').trim();
    const resolvedUsn = (claimantUsn || req.user.identifierCode || '').trim().toUpperCase();

    if (!foundItemId || !claimAnswers.identifyingDetailAnswer) {
      return res.status(400).json({
        success: false,
        error: 'foundItemId and claimAnswers.identifyingDetailAnswer are required.',
      });
    }

    if (!resolvedName || !resolvedUsn) {
      return res.status(400).json({
        success: false,
        error: 'Your Full Name and USN / Campus ID are required to submit a claim.',
      });
    }

    const foundItem = await FoundItem.findById(foundItemId);
    if (!foundItem) {
      return res.status(404).json({ success: false, error: 'Found item not found.' });
    }

    if (!['Stored', 'Claim Pending', 'Disposal Review'].includes(foundItem.status)) {
      return res.status(409).json({
        success: false,
        error: `This item cannot be claimed because its status is currently '${foundItem.status}'.`,
      });
    }

    // Prevent duplicate active claim by the same USN for the same item
    const existingUserClaim = await Claim.findOne({
      foundItemId: foundItem._id,
      claimantUsn: resolvedUsn,
      status: { $in: ['Pending', 'More Information Required', 'Approved'] },
    });

    if (existingUserClaim) {
      return res.status(409).json({
        success: false,
        error: `An active claim (${existingUserClaim.claimCode}) already exists under USN ${resolvedUsn} for this item.`,
      });
    }

    const count = await Claim.countDocuments();
    const claimCode = `CLM-2026-${801 + count + Math.floor(Math.random() * 90)}`;

    const claim = await Claim.create({
      claimCode,
      foundItemId: foundItem._id,
      lostReportId: lostReportId || null,
      claimantId: req.user._id,
      claimantName: resolvedName,
      claimantUsn: resolvedUsn,
      claimAnswers: {
        identifyingDetailAnswer: claimAnswers.identifyingDetailAnswer.trim(),
        serialOrContentsDetail: claimAnswers.serialOrContentsDetail || '',
        additionalContext: claimAnswers.additionalContext || '',
      },
      proofRefs: Array.isArray(proofRefs) ? proofRefs : [],
      status: 'Pending',
      submittedAt: new Date(),
    });

    // Freeze disposal eligibility & update foundItem status to Claim Pending
    const prevItemStatus = foundItem.status;
    foundItem.status = 'Claim Pending';
    foundItem.claimFreeze = true;
    await foundItem.save();

    if (lostReportId) {
      await LostReport.findByIdAndUpdate(lostReportId, {
        status: 'Claim Pending',
        matchedFoundItemId: foundItem._id,
      });
      await MatchCandidate.findOneAndUpdate(
        { lostReportId, foundItemId: foundItem._id },
        { state: 'Claim Initiated' }
      );
    }

    await ItemEvent.create({
      foundItemId: foundItem._id,
      actorId: req.user._id,
      eventType: 'CLAIM_SUBMITTED',
      fromStatus: prevItemStatus,
      toStatus: 'Claim Pending',
      note: `Ownership claim ${claimCode} submitted by ${resolvedName} (${resolvedUsn}). Disposal eligibility frozen.`,
    });

    await Notification.create({
      recipientId: req.user._id,
      type: 'CLAIM_SUBMITTED',
      title: `Claim Submitted: ${claimCode} for ${foundItem.itemName}`,
      message: `Your claim (${claimCode}) for item ${foundItem.itemCode} is now in the Admin Verification Queue. You will be notified once reviewed.`,
      relatedEntityType: 'Claim',
      relatedEntityId: claim._id,
    });

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: 'CLAIM_SUBMITTED',
      entityType: 'Claim',
      entityId: claim._id,
      beforeSummary: { foundItemStatus: prevItemStatus },
      afterSummary: { claimCode, status: 'Pending', foundItemStatus: 'Claim Pending', claimFreeze: true },
    });

    return res.status(201).json({
      success: true,
      data: claim,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/claims/mine — List current user's claims (without exposing admin private review notes)
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const claims = await Claim.find({ claimantId: req.user._id })
      .populate(
        'foundItemId',
        'itemCode itemName category description visibleAttributes foundAt foundLocation status imageRefs storageLocation'
      )
      .populate('lostReportId', 'reportCode itemName category status')
      .sort({ submittedAt: -1 })
      .lean();

    const sanitized = claims.map((c) => {
      const copy = { ...c };
      delete copy.reviewNotesPrivate;
      if (copy.foundItemId && !['Approved', 'Handed Over'].includes(copy.status)) {
        copy.foundItemId = {
          ...copy.foundItemId,
          storageLocation: 'Revealed upon Claim Approval',
        };
      }
      return copy;
    });

    return res.json({ success: true, data: sanitized });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/claims/:id/respond — Claimant updates answers when admin requests more information
router.patch('/:id/respond', authenticate, async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found.' });
    }
    if (claim.claimantId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this claim.' });
    }

    const { identifyingDetailAnswer, serialOrContentsDetail, additionalContext } = req.body;
    if (identifyingDetailAnswer) {
      claim.claimAnswers.identifyingDetailAnswer = identifyingDetailAnswer;
    }
    if (serialOrContentsDetail !== undefined) {
      claim.claimAnswers.serialOrContentsDetail = serialOrContentsDetail;
    }
    if (additionalContext !== undefined) {
      claim.claimAnswers.additionalContext = additionalContext;
    }
    claim.status = 'Pending';
    await claim.save();

    return res.json({ success: true, data: claim });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
