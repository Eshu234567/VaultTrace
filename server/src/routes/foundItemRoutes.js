const express = require('express');
const {
  FoundItem,
  ItemEvent,
  AuditLog,
  CampusLocation,
  MatchCandidate,
} = require('../models');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { matchForFoundItem } = require('../services/matchingService');
const { computeEligibilityDate } = require('../services/retentionService');

const router = express.Router();

function filterFoundItemByRole(item, role) {
  if (!item) return null;
  const obj = item.toObject ? item.toObject() : { ...item };
  if (role === 'student') {
    const prompt =
      obj.restrictedProof?.verificationPrompt ||
      'Describe any unique identifying mark, contents, or serial digits on the item.';
    delete obj.restrictedProof;
    delete obj.finderDetails;
    delete obj.handoverDetails;
    obj.storageLocation = 'Secured in Campus Vault (Exact Bin Hidden Until Claim Approved)';
    obj.verificationPrompt = prompt;
  }
  return obj;
}

// GET /api/found-items — Search, filter, sort, and paginate found inventory
router.get('/', authenticate, async (req, res, next) => {
  try {
    const {
      category,
      status,
      retentionClass,
      location,
      search,
      isBatchStationery,
      page = 1,
      limit = 30,
    } = req.query;

    const filter = {};
    if (category && category !== 'All') filter.category = category;
    if (status && status !== 'All') {
      filter.status = status;
    } else if (req.user.role === 'student') {
      // Students browsing public vault see Stored and Claim Pending items
      filter.status = { $in: ['Stored', 'Claim Pending'] };
    }
    if (retentionClass && retentionClass !== 'All') filter.retentionClass = retentionClass;
    if (location && location !== 'All') filter.foundLocation = location;
    if (isBatchStationery === 'true') filter.isBatchStationery = true;

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { itemCode: regex },
        { itemName: regex },
        { description: regex },
        { 'visibleAttributes.brand': regex },
        { 'visibleAttributes.colour': regex },
        { foundLocation: regex },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      FoundItem.find(filter)
        .populate('createdBy', 'name role department identifierCode')
        .sort({ foundAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      FoundItem.countDocuments(filter),
    ]);

    const roleFiltered = items.map((item) => filterFoundItemByRole(item, req.user.role));

    return res.json({
      success: true,
      data: roleFiltered,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/found-items/:id — Role-filtered item detail + chronological ItemEvents
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const item = await FoundItem.findById(req.params.id).populate(
      'createdBy',
      'name email role department identifierCode'
    );
    if (!item) {
      return res.status(404).json({ success: false, error: 'Found item not found.' });
    }

    const events = await ItemEvent.find({ foundItemId: item._id })
      .populate('actorId', 'name role identifierCode')
      .sort({ timestamp: -1 })
      .lean();

    const candidates = await MatchCandidate.find({ foundItemId: item._id })
      .populate({
        path: 'lostReportId',
        populate: { path: 'reporterId', select: 'name email identifierCode department' },
      })
      .sort({ score: -1 })
      .lean();

    return res.json({
      success: true,
      data: {
        item: filterFoundItemByRole(item, req.user.role),
        events: req.user.role === 'student' ? events.map((e) => ({ ...e, note: e.toStatus })) : events,
        candidates: req.user.role === 'student' ? [] : candidates,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/found-items — Register found item (Staff/Admin direct Stored intake; Student creates Pending Verification tip)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      category,
      itemName,
      description,
      visibleAttributes = {},
      restrictedProof = {},
      foundAt,
      foundLocation,
      storageLocation,
      finderDetails = {},
      estimatedValueBand,
      retentionClass = 'Standard',
      retentionDays,
      isBatchStationery = false,
      batchQuantity = 1,
      batchLabel = '',
      imageRefs = [],
    } = req.body;

    if (!category || !itemName || !description || !foundLocation) {
      return res.status(400).json({
        success: false,
        error: 'category, itemName, description, and foundLocation are required.',
      });
    }

    const isStudentTip = req.user.role === 'student';
    const initialStatus = isStudentTip ? 'Pending Verification' : 'Stored';

    let foundBuildingZone = 'Central Campus';
    let defaultBin = 'Central Vault Rack A • Bin #01';
    const locDoc = await CampusLocation.findOne({ name: foundLocation }).lean();
    if (locDoc) {
      foundBuildingZone = locDoc.buildingZone;
      defaultBin = locDoc.defaultVaultBin;
    }

    const effectiveRetentionClass =
      isBatchStationery || category === 'Stationery' ? 'Small / Low-Value' : retentionClass;

    const { retentionDays: computedDays, eligibleForDisposalAt } = computeEligibilityDate(
      foundAt || new Date(),
      effectiveRetentionClass,
      retentionDays ? Number(retentionDays) : undefined
    );

    const count = await FoundItem.countDocuments();
    const itemCode = `FND-2026-${101 + count + Math.floor(Math.random() * 90)}`;

    const item = await FoundItem.create({
      itemCode,
      createdBy: req.user._id,
      submittedByRole: req.user.role,
      category,
      itemName: itemName.trim(),
      description: description.trim(),
      visibleAttributes: {
        colour: visibleAttributes.colour || '',
        brand: visibleAttributes.brand || '',
        size: visibleAttributes.size || 'Medium / Handheld',
        material: visibleAttributes.material || '',
        tags: Array.isArray(visibleAttributes.tags) ? visibleAttributes.tags : [],
      },
      restrictedProof: {
        serialOrIdFragment: restrictedProof.serialOrIdFragment || '',
        hiddenMarkOrScratch: restrictedProof.hiddenMarkOrScratch || '',
        lockedScreenOrContents: restrictedProof.lockedScreenOrContents || '',
        verificationPrompt:
          restrictedProof.verificationPrompt ||
          'Describe any unique identifying mark, contents, or serial digits on the item.',
      },
      foundAt: foundAt ? new Date(foundAt) : new Date(),
      foundLocation: foundLocation.trim(),
      foundBuildingZone,
      storageLocation: isStudentTip
        ? 'Pending Staff Intake Verification'
        : storageLocation || defaultBin,
      finderDetails: {
        finderName: finderDetails.finderName || req.user.name,
        finderContact: finderDetails.finderContact || req.user.email,
      },
      status: initialStatus,
      estimatedValueBand: estimatedValueBand || (effectiveRetentionClass === 'Small / Low-Value' ? 'Low (< ₹500)' : 'Medium (₹500 - ₹3,000)'),
      retentionClass: effectiveRetentionClass,
      retentionDays: computedDays,
      eligibleForDisposalAt,
      isBatchStationery: Boolean(isBatchStationery),
      batchQuantity: Number(batchQuantity) || 1,
      batchLabel: batchLabel || (isBatchStationery ? `BOX-STAT-${Date.now().toString().slice(-4)}` : ''),
      imageRefs: Array.isArray(imageRefs) ? imageRefs : [],
    });

    await ItemEvent.create({
      foundItemId: item._id,
      actorId: req.user._id,
      eventType: isStudentTip ? 'TIP_SUBMITTED' : 'INTAKE_STORED',
      fromStatus: null,
      toStatus: initialStatus,
      note: isStudentTip
        ? `Student Found-Item Tip submitted by ${req.user.name} (${req.user.identifierCode}). Awaiting Staff/Admin verification.`
        : `Item registered and stored in ${item.storageLocation}. Retention class: ${item.retentionClass} (${item.retentionDays}d).`,
    });

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: isStudentTip ? 'STUDENT_FOUND_TIP_CREATED' : 'FOUND_ITEM_INTAKE_STORED',
      entityType: 'FoundItem',
      entityId: item._id,
      beforeSummary: null,
      afterSummary: {
        itemCode: item.itemCode,
        status: item.status,
        storageLocation: item.storageLocation,
        retentionClass: item.retentionClass,
      },
    });

    // If stored directly by staff/admin, trigger matching against active lost reports
    let candidates = [];
    if (initialStatus === 'Stored') {
      candidates = await matchForFoundItem(item._id);
    }

    return res.status(201).json({
      success: true,
      data: {
        item: filterFoundItemByRole(item, req.user.role),
        matchesTriggered: candidates.length,
        candidates,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/found-items/:id/verify-tip — Staff/Admin verifies a student Found Tip into Stored inventory
router.patch(
  '/:id/verify-tip',
  authenticate,
  authorizeRoles('staff', 'admin'),
  async (req, res, next) => {
    try {
      const item = await FoundItem.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ success: false, error: 'Found item not found.' });
      }

      const prevStatus = item.status;
      const { storageLocation, restrictedProof, retentionClass, retentionDays } = req.body;

      item.status = 'Stored';
      if (storageLocation) item.storageLocation = storageLocation;
      if (restrictedProof) {
        item.restrictedProof = { ...item.restrictedProof.toObject(), ...restrictedProof };
      }
      if (retentionClass) {
        item.retentionClass = retentionClass;
        const { retentionDays: d, eligibleForDisposalAt } = computeEligibilityDate(
          item.foundAt,
          retentionClass,
          retentionDays ? Number(retentionDays) : undefined
        );
        item.retentionDays = d;
        item.eligibleForDisposalAt = eligibleForDisposalAt;
      }

      await item.save();

      await ItemEvent.create({
        foundItemId: item._id,
        actorId: req.user._id,
        eventType: 'INTAKE_STORED',
        fromStatus: prevStatus,
        toStatus: 'Stored',
        note: `Verified into physical storage (${item.storageLocation}) by ${req.user.name}.`,
      });

      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'FOUND_TIP_VERIFIED_TO_VAULT',
        entityType: 'FoundItem',
        entityId: item._id,
        beforeSummary: { status: prevStatus },
        afterSummary: { status: 'Stored', storageLocation: item.storageLocation },
      });

      const candidates = await matchForFoundItem(item._id);

      return res.json({
        success: true,
        data: {
          item,
          matchesTriggered: candidates.length,
          candidates,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
