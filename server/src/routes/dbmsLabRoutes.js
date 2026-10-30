const express = require('express');
const mongoose = require('mongoose');
const {
  User,
  LostReport,
  FoundItem,
  MatchCandidate,
  Claim,
  Notification,
  ItemEvent,
  DisposalRecord,
  AuditLog,
  CampusLocation,
} = require('../models');
const { authenticate } = require('../middleware/auth');
const { getDbMode, syncAllIndexes } = require('../config/db');
const { seedDatabase } = require('../utils/seedData');

const router = express.Router();

const MODEL_MAP = {
  users: User,
  lostReports: LostReport,
  foundItems: FoundItem,
  matchCandidates: MatchCandidate,
  claims: Claim,
  notifications: Notification,
  itemEvents: ItemEvent,
  disposalRecords: DisposalRecord,
  auditLogs: AuditLog,
  campusLocations: CampusLocation,
};

// GET /api/dbms-lab/overview — Full Collection counts, Index Inventory, and Logical ER Schema metadata
router.get('/overview', authenticate, async (req, res, next) => {
  try {
    await syncAllIndexes();

    const collectionsInfo = [];
    for (const [collectionName, Model] of Object.entries(MODEL_MAP)) {
      const count = await Model.countDocuments();
      let indexes = [];
      try {
        indexes = await Model.collection.indexes();
      } catch (_) {
        indexes = [];
      }
      collectionsInfo.push({
        collectionName,
        modelName: Model.modelName,
        documentCount: count,
        indexes: indexes.map((idx) => ({
          name: idx.name,
          key: idx.key,
          unique: Boolean(idx.unique),
          sparse: Boolean(idx.sparse),
          weights: idx.weights || null,
        })),
      });
    }

    const erRelationships = [
      {
        from: 'users',
        to: 'lostReports',
        cardinality: '1 : N',
        field: 'lostReports.reporterId -> users._id',
        rationale: 'Independent lifecycle & pagination; avoids unbounded array growth inside User document.',
      },
      {
        from: 'users',
        to: 'foundItems',
        cardinality: '1 : N',
        field: 'foundItems.createdBy -> users._id',
        rationale: 'Tracks staff/admin custodian or student tipster who registered the item.',
      },
      {
        from: 'lostReports',
        to: 'foundItems',
        via: 'matchCandidates',
        cardinality: 'N : M',
        field: 'Unique compound index { lostReportId: 1, foundItemId: 1 }',
        rationale: 'Stores weighted match score (0-100), scoreBreakdown, and matchedFields per pair.',
      },
      {
        from: 'foundItems',
        to: 'claims',
        cardinality: '1 : N (Max 1 Active Approved)',
        field: 'claims.foundItemId -> foundItems._id',
        rationale: 'Multiple users may submit claims over time, but service-level constraint allows only one Approved claim.',
      },
      {
        from: 'foundItems',
        to: 'itemEvents',
        cardinality: '1 : N (Append-Only)',
        field: 'itemEvents.foundItemId -> foundItems._id',
        rationale: 'Immutable custody & status transition history with bounded fromStatus/toStatus snapshots.',
      },
      {
        from: 'foundItems',
        to: 'disposalRecords',
        cardinality: '1 : 0..1',
        field: 'disposalRecords.foundItemId -> foundItems._id',
        rationale: 'Retains permanent snapshot (itemCodeSnapshot, reason, witness) when unclaimed items are donated/disposed.',
      },
      {
        from: 'users',
        to: 'auditLogs',
        cardinality: '1 : N',
        field: 'auditLogs.actorId -> users._id',
        rationale: 'Security trail with beforeSummary and afterSummary for every sensitive mutation.',
      },
    ];

    return res.json({
      success: true,
      data: {
        dbMode: getDbMode(),
        databaseName: mongoose.connection.name || 'vaulttrace_db',
        collections: collectionsInfo,
        erRelationships,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/dbms-lab/run-preset — Execute preset DBMS Viva Queries (Aggregations, $lookup, Text Search, Explain Plans)
router.post('/run-preset', authenticate, async (req, res, next) => {
  try {
    const { presetId } = req.body;
    const startTime = Date.now();

    let title = '';
    let mongoshEquivalent = '';
    let pipelineOrQuery = null;
    let results = [];
    let explainStats = null;

    switch (presetId) {
      case 'LOOKUP_CLAIMS_USERS_ITEMS': {
        title = '$lookup Join: Claims joined with Claimant User & Found Item Details';
        mongoshEquivalent = `db.claims.aggregate([
  { $lookup: { from: "users", localField: "claimantId", foreignField: "_id", as: "claimant" } },
  { $unwind: "$claimant" },
  { $lookup: { from: "foundItems", localField: "foundItemId", foreignField: "_id", as: "item" } },
  { $unwind: "$item" },
  { $project: { claimCode: 1, status: 1, submittedAt: 1, "claimant.name": 1, "claimant.identifierCode": 1, "item.itemCode": 1, "item.itemName": 1, "item.storageLocation": 1 } }
])`;
        pipelineOrQuery = [
          { $lookup: { from: 'users', localField: 'claimantId', foreignField: '_id', as: 'claimant' } },
          { $unwind: '$claimant' },
          { $lookup: { from: 'foundItems', localField: 'foundItemId', foreignField: '_id', as: 'item' } },
          { $unwind: '$item' },
          {
            $project: {
              claimCode: 1,
              status: 1,
              handoverPassCode: 1,
              submittedAt: 1,
              'claimant.name': 1,
              'claimant.identifierCode': 1,
              'claimant.department': 1,
              'item.itemCode': 1,
              'item.itemName': 1,
              'item.category': 1,
              'item.status': 1,
            },
          },
          { $sort: { submittedAt: -1 } },
        ];
        results = await Claim.aggregate(pipelineOrQuery);
        break;
      }

      case 'LOOKUP_MATCH_CANDIDATES': {
        title = '$lookup Join: High-Confidence Match Candidates with Lost Report & Found Item';
        mongoshEquivalent = `db.matchCandidates.aggregate([
  { $match: { score: { $gte: 50 } } },
  { $lookup: { from: "lostReports", localField: "lostReportId", foreignField: "_id", as: "lostReport" } },
  { $unwind: "$lostReport" },
  { $lookup: { from: "foundItems", localField: "foundItemId", foreignField: "_id", as: "foundItem" } },
  { $unwind: "$foundItem" },
  { $sort: { score: -1 } }
])`;
        pipelineOrQuery = [
          { $match: { score: { $gte: 50 } } },
          { $lookup: { from: 'lostReports', localField: 'lostReportId', foreignField: '_id', as: 'lostReport' } },
          { $unwind: '$lostReport' },
          { $lookup: { from: 'foundItems', localField: 'foundItemId', foreignField: '_id', as: 'foundItem' } },
          { $unwind: '$foundItem' },
          {
            $project: {
              score: 1,
              confidenceBand: 1,
              matchedFields: 1,
              scoreBreakdown: 1,
              'lostReport.reportCode': 1,
              'lostReport.itemName': 1,
              'lostReport.lastSeen.location': 1,
              'foundItem.itemCode': 1,
              'foundItem.itemName': 1,
              'foundItem.foundLocation': 1,
            },
          },
          { $sort: { score: -1 } },
        ];
        results = await MatchCandidate.aggregate(pipelineOrQuery);
        break;
      }

      case 'AGG_RETENTION_AGING': {
        title = 'Aggregation Pipeline: Inventory Ageing & Retention Class Summary';
        mongoshEquivalent = `db.foundItems.aggregate([
  { $group: {
      _id: { retentionClass: "$retentionClass", status: "$status" },
      recordCount: { $sum: 1 },
      totalPhysicalUnits: { $sum: "$batchQuantity" },
      avgRetentionDaysPolicy: { $avg: "$retentionDays" }
  }},
  { $sort: { "_id.retentionClass": 1 } }
])`;
        pipelineOrQuery = [
          {
            $group: {
              _id: { retentionClass: '$retentionClass', status: '$status' },
              recordCount: { $sum: 1 },
              totalPhysicalUnits: { $sum: '$batchQuantity' },
              avgRetentionDaysPolicy: { $avg: '$retentionDays' },
            },
          },
          { $sort: { '_id.retentionClass': 1, recordCount: -1 } },
        ];
        results = await FoundItem.aggregate(pipelineOrQuery);
        break;
      }

      case 'AGG_CAMPUS_HOTSPOTS': {
        title = 'Aggregation Pipeline: Campus Building Zone Recovery & Loss Density';
        mongoshEquivalent = `db.foundItems.aggregate([
  { $group: {
      _id: "$foundBuildingZone",
      totalFoundItems: { $sum: 1 },
      returnedItems: { $sum: { $cond: [{ $eq: ["$status", "Returned"] }, 1, 0] } },
      activeInVault: { $sum: { $cond: [{ $in: ["$status", ["Stored", "Claim Pending"]] }, 1, 0] } }
  }},
  { $sort: { totalFoundItems: -1 } }
])`;
        pipelineOrQuery = [
          {
            $group: {
              _id: '$foundBuildingZone',
              totalFoundItems: { $sum: 1 },
              returnedItems: { $sum: { $cond: [{ $eq: ['$status', 'Returned'] }, 1, 0] } },
              activeInVault: {
                $sum: { $cond: [{ $in: ['$status', ['Stored', 'Claim Pending']] }, 1, 0] },
              },
            },
          },
          { $sort: { totalFoundItems: -1 } },
        ];
        results = await FoundItem.aggregate(pipelineOrQuery);
        break;
      }

      case 'EXPLAIN_COMPOUND_INDEX': {
        title = "explain('executionStats'): Compound Index Query on foundItems { status: 1, category: 1, foundAt: -1 }";
        mongoshEquivalent = `db.foundItems.find({ status: "Stored", category: "Electronics" }).sort({ foundAt: -1 }).explain("executionStats")`;
        const filter = { status: 'Stored', category: 'Electronics' };
        results = await FoundItem.find(filter)
          .select('itemCode itemName category status foundAt foundLocation')
          .sort({ foundAt: -1 })
          .lean();
        const rawExplain = await FoundItem.find(filter)
          .sort({ foundAt: -1 })
          .explain('executionStats');
        const execStats = rawExplain.executionStats || rawExplain[0]?.executionStats || {};
        const winningPlan = rawExplain.queryPlanner?.winningPlan || {};
        explainStats = {
          executionSuccess: execStats.executionSuccess ?? true,
          nReturned: execStats.nReturned ?? results.length,
          executionTimeMillis: execStats.executionTimeMillis ?? 0,
          totalKeysExamined: execStats.totalKeysExamined ?? results.length,
          totalDocsExamined: execStats.totalDocsExamined ?? results.length,
          winningPlanStage: winningPlan.stage || winningPlan.inputStage?.stage || 'IXSCAN',
          indexUsed:
            winningPlan.indexName ||
            winningPlan.inputStage?.indexName ||
            'idx_foundItems_status_cat_foundAt',
        };
        break;
      }

      case 'TEXT_INDEX_SEARCH': {
        title = 'Full-Text Index Search ($text) on foundItems with textScore Projection';
        mongoshEquivalent = `db.foundItems.find({ $text: { $search: "airpods casio calculator" } }, { score: { $meta: "textScore" } }).sort({ score: { $meta: "textScore" } })`;
        results = await FoundItem.find(
          { $text: { $search: 'airpods casio calculator milton' } },
          { score: { $meta: 'textScore' }, restrictedProof: 0 }
        )
          .sort({ score: { $meta: 'textScore' } })
          .lean();
        break;
      }

      default:
        return res.status(400).json({ success: false, error: 'Unknown presetId.' });
    }

    const durationMs = Date.now() - startTime;
    return res.json({
      success: true,
      data: {
        presetId,
        title,
        mongoshEquivalent,
        durationMs,
        resultCount: results.length,
        results,
        explainStats,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dbms-lab/collection/:name — Inspect documents in any collection live
router.get('/collection/:name', authenticate, async (req, res, next) => {
  try {
    const Model = MODEL_MAP[req.params.name];
    if (!Model) {
      return res.status(400).json({ success: false, error: 'Invalid collection name.' });
    }

    const { filterJson, limit = 25 } = req.query;
    let parsedFilter = {};
    if (filterJson && filterJson.trim()) {
      try {
        parsedFilter = JSON.parse(filterJson);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: `Invalid JSON filter syntax: ${e.message}`,
        });
      }
    }

    const [docs, total] = await Promise.all([
      Model.find(parsedFilter).sort({ _id: -1 }).limit(Number(limit)).lean(),
      Model.countDocuments(parsedFilter),
    ]);

    let explainSummary = null;
    try {
      const rawExplain = await Model.find(parsedFilter).limit(Number(limit)).explain('executionStats');
      const stats = rawExplain.executionStats || {};
      explainSummary = {
        nReturned: stats.nReturned,
        executionTimeMillis: stats.executionTimeMillis,
        totalKeysExamined: stats.totalKeysExamined,
        totalDocsExamined: stats.totalDocsExamined,
        winningStage:
          rawExplain.queryPlanner?.winningPlan?.stage ||
          rawExplain.queryPlanner?.winningPlan?.inputStage?.stage ||
          'SCAN',
      };
    } catch (_) {
      explainSummary = null;
    }

    return res.json({
      success: true,
      data: {
        collectionName: req.params.name,
        totalMatching: total,
        explainSummary,
        documents: docs,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/dbms-lab/collection/:name/:id — Live Document Editor for Evaluators (Validates via Mongoose Schema!)
router.patch('/collection/:name/:id', authenticate, async (req, res, next) => {
  try {
    const Model = MODEL_MAP[req.params.name];
    if (!Model) {
      return res.status(400).json({ success: false, error: 'Invalid collection name.' });
    }

    const { updates } = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'updates object is required.' });
    }

    const existing = await Model.findById(req.params.id).lean();
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    // Remove immutable _id field from updates
    const cleanUpdates = { ...updates };
    delete cleanUpdates._id;

    const updated = await Model.findByIdAndUpdate(
      req.params.id,
      { $set: cleanUpdates },
      { new: true, runValidators: true }
    );

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: `DBMS_LAB_LIVE_DOCUMENT_EDIT (${req.params.name})`,
      entityType: 'DatabaseLab',
      entityId: updated._id,
      beforeSummary: existing,
      afterSummary: cleanUpdates,
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    // Return validation or duplicate key errors clearly for DBMS demonstration
    return res.status(400).json({
      success: false,
      error: `Mongoose Schema / Constraint Error: ${err.message}`,
    });
  }
});

// POST /api/dbms-lab/test-constraint — Live Constraint & Validation Tester for Evaluators
router.post('/test-constraint', authenticate, async (req, res) => {
  const { testType } = req.body;

  try {
    if (testType === 'DUPLICATE_ITEM_CODE') {
      const existing = await FoundItem.findOne().lean();
      await FoundItem.create({
        itemCode: existing ? existing.itemCode : 'FND-2026-101',
        createdBy: req.user._id,
        category: 'Electronics',
        itemName: 'Duplicate Item Code Test',
        description: 'Testing unique index enforcement on foundItems.itemCode',
        foundAt: new Date(),
        foundLocation: 'ISE Department Block - Lab 302',
        storageLocation: 'Test Bin',
        eligibleForDisposalAt: new Date(),
      });
    } else if (testType === 'INVALID_ENUM_CATEGORY') {
      await LostReport.create({
        reportCode: `TEST-ENUM-${Date.now()}`,
        reporterId: req.user._id,
        itemName: 'Invalid Category Test',
        category: 'Spaceship_Invalid_Category',
        description: 'Testing Mongoose enum constraint validation',
        lastSeen: { date: new Date(), location: 'Central Library' },
      });
    } else if (testType === 'DUPLICATE_MATCH_PAIR') {
      const existingPair = await MatchCandidate.findOne().lean();
      if (existingPair) {
        await MatchCandidate.create({
          lostReportId: existingPair.lostReportId,
          foundItemId: existingPair.foundItemId,
          score: 88,
          confidenceBand: 'High Potential Match',
        });
      }
    }

    return res.json({
      success: true,
      message: 'Operation unexpectedly succeeded.',
    });
  } catch (err) {
    return res.status(422).json({
      success: false,
      constraintEnforced: true,
      errorType: err.code === 11000 ? 'E11000 Duplicate Key Index Constraint' : err.name,
      message: err.message,
    });
  }
});

// POST /api/dbms-lab/reseed — One-click reset to clean demo dataset during evaluation
router.post('/reseed', authenticate, async (req, res, next) => {
  try {
    const result = await seedDatabase({ forceReset: true });
    return res.json({
      success: true,
      message: 'Database reset and re-seeded with fresh campus demo dataset.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
