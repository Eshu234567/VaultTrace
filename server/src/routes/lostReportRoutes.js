const express = require('express');
const { LostReport, MatchCandidate, FoundItem, CampusLocation, AuditLog } = require('../models');
const { authenticate } = require('../middleware/auth');
const { matchForLostReport } = require('../services/matchingService');

const router = express.Router();

function sanitizeFoundItemForStudent(item) {
  if (!item) return null;
  const obj = item.toObject ? item.toObject() : { ...item };
  // Never expose restrictedProof, exact storage coordinates, or finder phone to students
  delete obj.restrictedProof;
  delete obj.handoverDetails;
  delete obj.finderDetails;
  obj.storageLocation = 'Secured in Campus Vault (Exact Bin Hidden Until Claim Approved)';
  obj.verificationPrompt =
    item.restrictedProof?.verificationPrompt ||
    'Describe a unique hidden mark, contents, or serial fragment to claim this item.';
  return obj;
}

// POST /api/lost-reports — Create lost report & trigger weighted matching
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      itemName,
      category,
      description,
      attributes = {},
      lastSeen = {},
      imageRefs = [],
    } = req.body;

    if (!itemName || !category || !description || !lastSeen.date || !lastSeen.location) {
      return res.status(400).json({
        success: false,
        error: 'itemName, category, description, lastSeen.date, and lastSeen.location are required.',
      });
    }

    let buildingZone = lastSeen.buildingZone || 'Central Campus';
    const matchedLoc = await CampusLocation.findOne({ name: lastSeen.location }).lean();
    if (matchedLoc) {
      buildingZone = matchedLoc.buildingZone;
    }

    const count = await LostReport.countDocuments();
    const reportCode = `LST-2026-${501 + count + Math.floor(Math.random() * 90)}`;

    const report = await LostReport.create({
      reportCode,
      reporterId: req.user._id,
      itemName: itemName.trim(),
      category,
      description: description.trim(),
      attributes: {
        colour: attributes.colour || '',
        brand: attributes.brand || '',
        size: attributes.size || 'Medium / Handheld',
        material: attributes.material || '',
        distinctiveMarks: attributes.distinctiveMarks || '',
        tags: Array.isArray(attributes.tags) ? attributes.tags : [],
      },
      lastSeen: {
        date: new Date(lastSeen.date),
        location: lastSeen.location.trim(),
        buildingZone,
      },
      imageRefs: Array.isArray(imageRefs) ? imageRefs : [],
      status: 'Active',
    });

    // Run weighted matching engine against stored foundItems
    const candidates = await matchForLostReport(report._id);
    const updatedReport = await LostReport.findById(report._id).populate('reporterId', 'name email department identifierCode');

    // Populate candidate foundItem summaries (sanitized)
    const populatedCandidates = await MatchCandidate.find({ lostReportId: report._id })
      .populate('foundItemId')
      .sort({ score: -1 });

    const safeCandidates = populatedCandidates.map((c) => ({
      _id: c._id,
      score: c.score,
      confidenceBand: c.confidenceBand,
      matchedFields: c.matchedFields,
      scoreBreakdown: c.scoreBreakdown,
      explanation: c.explanation,
      state: c.state,
      foundItem:
        req.user.role === 'student'
          ? sanitizeFoundItemForStudent(c.foundItemId)
          : c.foundItemId,
    }));

    return res.status(201).json({
      success: true,
      data: {
        report: updatedReport,
        matchesFound: safeCandidates.length,
        candidates: safeCandidates,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/lost-reports/mine — Current user's reports
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { reporterId: req.user._id, isArchived: false };
    if (status && status !== 'All') {
      filter.status = status;
    }

    const reports = await LostReport.find(filter)
      .populate('matchedFoundItemId', 'itemCode itemName category status foundLocation')
      .sort({ createdAt: -1 })
      .lean();

    // Attach top match count for each report
    const reportIds = reports.map((r) => r._id);
    const allCandidates = await MatchCandidate.find({
      lostReportId: { $in: reportIds },
      score: { $gte: 45 },
    })
      .populate('foundItemId')
      .sort({ score: -1 });

    const byReport = {};
    for (const c of allCandidates) {
      const key = c.lostReportId.toString();
      if (!byReport[key]) byReport[key] = [];
      byReport[key].push({
        _id: c._id,
        score: c.score,
        confidenceBand: c.confidenceBand,
        matchedFields: c.matchedFields,
        scoreBreakdown: c.scoreBreakdown,
        explanation: c.explanation,
        state: c.state,
        foundItem:
          req.user.role === 'student'
            ? sanitizeFoundItemForStudent(c.foundItemId)
            : c.foundItemId,
      });
    }

    const enriched = reports.map((r) => ({
      ...r,
      candidateMatches: byReport[r._id.toString()] || [],
    }));

    return res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
});

// GET /api/lost-reports — Search/filter active reports (Staff/Admin see all; students see their own + public summary)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { category, status, location, search, page = 1, limit = 25 } = req.query;
    const filter = { isArchived: false };

    if (category && category !== 'All') filter.category = category;
    if (status && status !== 'All') filter.status = status;
    if (location && location !== 'All') filter['lastSeen.location'] = location;
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { itemName: regex },
        { description: regex },
        { reportCode: regex },
        { 'attributes.brand': regex },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [reports, total] = await Promise.all([
      LostReport.find(filter)
        .populate('reporterId', 'name email department identifierCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      LostReport.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: reports,
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

// GET /api/lost-reports/:id/matches — Candidate matches for a specific lost report
router.get('/:id/matches', authenticate, async (req, res, next) => {
  try {
    const report = await LostReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Lost report not found.' });
    }

    if (
      req.user.role === 'student' &&
      report.reporterId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: 'You can only view candidate matches for your own lost reports.',
      });
    }

    // Re-run matching to ensure fresh results
    await matchForLostReport(report._id);

    const candidates = await MatchCandidate.find({ lostReportId: report._id })
      .populate('foundItemId')
      .sort({ score: -1 });

    const formatted = candidates
      .filter((c) => c.foundItemId)
      .map((c) => ({
        _id: c._id,
        score: c.score,
        confidenceBand: c.confidenceBand,
        matchedFields: c.matchedFields,
        scoreBreakdown: c.scoreBreakdown,
        explanation: c.explanation,
        state: c.state,
        foundItem:
          req.user.role === 'student'
            ? sanitizeFoundItemForStudent(c.foundItemId)
            : c.foundItemId,
      }));

    return res.json({
      success: true,
      data: {
        report,
        candidates: formatted,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/lost-reports/:id — Update or soft-archive a lost report
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const report = await LostReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Lost report not found.' });
    }

    if (
      req.user.role === 'student' &&
      report.reporterId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, error: 'Not authorized to edit this report.' });
    }

    const beforeStatus = report.status;
    const { status, isArchived, description, attributes } = req.body;

    if (status) report.status = status;
    if (typeof isArchived === 'boolean') {
      report.isArchived = isArchived;
      if (isArchived) report.status = 'Archived';
    }
    if (description) report.description = description;
    if (attributes) {
      report.attributes = { ...report.attributes.toObject(), ...attributes };
    }

    await report.save();

    if (status === 'Active' || description || attributes) {
      await matchForLostReport(report._id);
    }

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: isArchived ? 'LOST_REPORT_ARCHIVED' : 'LOST_REPORT_UPDATED',
      entityType: 'LostReport',
      entityId: report._id,
      beforeSummary: { status: beforeStatus },
      afterSummary: { status: report.status, isArchived: report.isArchived },
    });

    return res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
