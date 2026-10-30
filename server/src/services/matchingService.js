const { LostReport, FoundItem, MatchCandidate, Notification, CampusLocation } = require('../models');

// Normalize tokens for keyword overlap comparison
function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !['the', 'and', 'with', 'for', 'near', 'from', 'lost', 'found', 'item'].includes(word));
}

function computePairScore(lostReport, foundItem, locationZoneMap = {}) {
  const matchedFields = [];
  const breakdown = {
    categoryScore: 0,   // max 25
    keywordScore: 0,    // max 20
    attributeScore: 0,  // max 15
    locationScore: 0,   // max 15
    dateScore: 0,       // max 15
    brandScore: 0,      // max 10
  };

  // 1. Category (Weight: 25%)
  if (lostReport.category && foundItem.category) {
    if (lostReport.category === foundItem.category) {
      breakdown.categoryScore = 25;
      matchedFields.push(`Category (${lostReport.category})`);
    } else {
      const relatedPairs = [
        ['Electronics', 'Calculator / Lab Gear'],
        ['Wallet / Purse', 'ID / Smart Card'],
        ['Stationery', 'Books / Notes'],
      ];
      const isRelated = relatedPairs.some(
        (pair) => pair.includes(lostReport.category) && pair.includes(foundItem.category)
      );
      if (isRelated) {
        breakdown.categoryScore = 10;
        matchedFields.push('Related Category');
      }
    }
  }

  // 2. Item name & keyword overlap (Weight: 20%)
  const lostTokens = new Set([
    ...tokenize(lostReport.itemName),
    ...tokenize(lostReport.description),
    ...(lostReport.attributes?.tags || []).map((t) => t.toLowerCase()),
  ]);
  const foundTokens = new Set([
    ...tokenize(foundItem.itemName),
    ...tokenize(foundItem.description),
    ...(foundItem.visibleAttributes?.tags || []).map((t) => t.toLowerCase()),
  ]);

  if (lostTokens.size > 0 && foundTokens.size > 0) {
    const shared = [...lostTokens].filter((t) => foundTokens.has(t));
    if (shared.length > 0) {
      const ratio = Math.min(1, shared.length / Math.min(4, lostTokens.size));
      breakdown.keywordScore = Math.round(ratio * 20);
      matchedFields.push(`Keywords (${shared.slice(0, 4).join(', ')})`);
    }
  }

  // 3. Colour / Material / Size (Weight: 15%)
  let attrPoints = 0;
  const lostCol = (lostReport.attributes?.colour || '').toLowerCase().trim();
  const foundCol = (foundItem.visibleAttributes?.colour || '').toLowerCase().trim();
  if (lostCol && foundCol) {
    if (lostCol === foundCol || lostCol.includes(foundCol) || foundCol.includes(lostCol)) {
      attrPoints += 9;
      matchedFields.push(`Colour (${foundItem.visibleAttributes.colour})`);
    }
  } else {
    // Missing values do not count as strong mismatches
    attrPoints += 3;
  }

  const lostMat = (lostReport.attributes?.material || '').toLowerCase().trim();
  const foundMat = (foundItem.visibleAttributes?.material || '').toLowerCase().trim();
  if (lostMat && foundMat && (lostMat === foundMat || lostMat.includes(foundMat))) {
    attrPoints += 3;
    matchedFields.push(`Material (${foundItem.visibleAttributes.material})`);
  }

  const lostSize = (lostReport.attributes?.size || '').toLowerCase().trim();
  const foundSize = (foundItem.visibleAttributes?.size || '').toLowerCase().trim();
  if (lostSize && foundSize && lostSize === foundSize) {
    attrPoints += 3;
    matchedFields.push(`Size (${foundItem.visibleAttributes.size})`);
  }
  breakdown.attributeScore = Math.min(15, attrPoints);

  // 4. Location proximity (Weight: 15%)
  const lostLoc = (lostReport.lastSeen?.location || '').toLowerCase().trim();
  const foundLoc = (foundItem.foundLocation || '').toLowerCase().trim();
  const lostZone = lostReport.lastSeen?.buildingZone || locationZoneMap[lostLoc] || '';
  const foundZone = foundItem.foundBuildingZone || locationZoneMap[foundLoc] || '';

  if (lostLoc && foundLoc) {
    if (lostLoc === foundLoc || lostLoc.includes(foundLoc) || foundLoc.includes(lostLoc)) {
      breakdown.locationScore = 15;
      matchedFields.push(`Exact Location (${foundItem.foundLocation})`);
    } else if (lostZone && foundZone && lostZone === foundZone) {
      breakdown.locationScore = 10;
      matchedFields.push(`Same Campus Zone (${foundZone})`);
    } else {
      breakdown.locationScore = 3;
    }
  }

  // 5. Date proximity (Weight: 15%)
  if (lostReport.lastSeen?.date && foundItem.foundAt) {
    const lostTime = new Date(lostReport.lastSeen.date).getTime();
    const foundTime = new Date(foundItem.foundAt).getTime();
    const diffDays = Math.abs(foundTime - lostTime) / (1000 * 60 * 60 * 24);

    // If found way before it was lost (> 3 days prior), lower score
    if (foundTime < lostTime - 3 * 86400000) {
      breakdown.dateScore = 2;
    } else if (diffDays <= 1.5) {
      breakdown.dateScore = 15;
      matchedFields.push('Same/Next Day Window');
    } else if (diffDays <= 4) {
      breakdown.dateScore = 12;
      matchedFields.push('Within 4 Days');
    } else if (diffDays <= 10) {
      breakdown.dateScore = 8;
      matchedFields.push('Within 10 Days');
    } else if (diffDays <= 21) {
      breakdown.dateScore = 4;
    }
  }

  // 6. Brand / Distinctive visible detail (Weight: 10%)
  const lostBrand = (lostReport.attributes?.brand || '').toLowerCase().trim();
  const foundBrand = (foundItem.visibleAttributes?.brand || '').toLowerCase().trim();
  if (lostBrand && foundBrand) {
    if (lostBrand === foundBrand || lostBrand.includes(foundBrand) || foundBrand.includes(lostBrand)) {
      breakdown.brandScore = 10;
      matchedFields.push(`Brand (${foundItem.visibleAttributes.brand})`);
    }
  } else if (!lostBrand && !foundBrand) {
    breakdown.brandScore = 3;
  }

  const totalScore = Math.min(
    100,
    breakdown.categoryScore +
      breakdown.keywordScore +
      breakdown.attributeScore +
      breakdown.locationScore +
      breakdown.dateScore +
      breakdown.brandScore
  );

  let confidenceBand = 'Low Match';
  if (totalScore >= 75) {
    confidenceBand = 'High Potential Match';
  } else if (totalScore >= 50) {
    confidenceBand = 'Possible Match';
  }

  const explanation =
    matchedFields.length > 0
      ? `Matched on ${matchedFields.join(' • ')} (${totalScore}% confidence)`
      : `Low attribute overlap (${totalScore}%)`;

  return {
    score: totalScore,
    confidenceBand,
    matchedFields,
    scoreBreakdown: breakdown,
    explanation,
  };
}

async function buildZoneLookup() {
  const locs = await CampusLocation.find({ active: true }).lean();
  const map = {};
  for (const l of locs) {
    map[l.name.toLowerCase()] = l.buildingZone;
  }
  return map;
}

/**
 * Trigger 1: When a Lost Report is created or updated, scan all active Stored/Claim Pending found items.
 */
async function matchForLostReport(lostReportId) {
  const report = await LostReport.findById(lostReportId);
  if (!report || ['Resolved', 'Archived'].includes(report.status)) return [];

  const zoneMap = await buildZoneLookup();
  const activeFoundItems = await FoundItem.find({
    status: { $in: ['Stored', 'Claim Pending'] },
  });

  const persistedCandidates = [];
  let hasHighOrPossible = false;

  for (const item of activeFoundItems) {
    const result = computePairScore(report, item, zoneMap);
    if (result.score >= 38) {
      const candidate = await MatchCandidate.findOneAndUpdate(
        { lostReportId: report._id, foundItemId: item._id },
        {
          $set: {
            score: result.score,
            confidenceBand: result.confidenceBand,
            matchedFields: result.matchedFields,
            scoreBreakdown: result.scoreBreakdown,
            explanation: result.explanation,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      persistedCandidates.push(candidate);

      if (result.score >= 50) {
        hasHighOrPossible = true;
        // Idempotent notification creation
        const dedupeKey = `MATCH_${report._id}_${item._id}`;
        const existingNotif = await Notification.findOne({ dedupeKey });
        if (!existingNotif) {
          await Notification.create({
            recipientId: report.reporterId,
            type: 'MATCH_FOUND',
            title: `${result.confidenceBand}: ${item.category} found near ${item.foundLocation}`,
            message: `A found item (${item.itemCode}) scored ${result.score}% against your report "${report.itemName}". Sign in to review details and submit an ownership claim if it is yours.`,
            relatedEntityType: 'LostReport',
            relatedEntityId: report._id,
            dedupeKey,
          });
          candidate.notificationSent = true;
          await candidate.save();
        }
      }
    }
  }

  if (hasHighOrPossible && report.status === 'Active') {
    report.status = 'Possible Match';
    await report.save();
  }

  return persistedCandidates.sort((a, b) => b.score - a.score);
}

/**
 * Trigger 2: When a Found Item is registered or verified into Stored status, scan active Lost Reports.
 */
async function matchForFoundItem(foundItemId) {
  const item = await FoundItem.findById(foundItemId);
  if (!item || !['Stored', 'Claim Pending'].includes(item.status)) return [];

  const zoneMap = await buildZoneLookup();
  const activeReports = await LostReport.find({
    status: { $in: ['Active', 'Possible Match'] },
    isArchived: false,
  });

  const persistedCandidates = [];

  for (const report of activeReports) {
    const result = computePairScore(report, item, zoneMap);
    if (result.score >= 38) {
      const candidate = await MatchCandidate.findOneAndUpdate(
        { lostReportId: report._id, foundItemId: item._id },
        {
          $set: {
            score: result.score,
            confidenceBand: result.confidenceBand,
            matchedFields: result.matchedFields,
            scoreBreakdown: result.scoreBreakdown,
            explanation: result.explanation,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      persistedCandidates.push(candidate);

      if (result.score >= 50) {
        if (report.status === 'Active') {
          report.status = 'Possible Match';
          await report.save();
        }
        const dedupeKey = `MATCH_${report._id}_${item._id}`;
        const existingNotif = await Notification.findOne({ dedupeKey });
        if (!existingNotif) {
          await Notification.create({
            recipientId: report.reporterId,
            type: 'MATCH_FOUND',
            title: `${result.confidenceBand}: New ${item.category} logged in Vault`,
            message: `A newly registered found item (${item.itemCode}) may match your report "${report.itemName}" (${result.score}% match score). Review candidate details to claim.`,
            relatedEntityType: 'LostReport',
            relatedEntityId: report._id,
            dedupeKey,
          });
          candidate.notificationSent = true;
          await candidate.save();
        }
      }
    }
  }

  return persistedCandidates.sort((a, b) => b.score - a.score);
}

/**
 * Nightly / On-Demand Reconciliation Job: Re-evaluates all active reports vs stored items.
 */
async function runFullReconciliation() {
  const activeReports = await LostReport.find({
    status: { $in: ['Active', 'Possible Match'] },
    isArchived: false,
  }).select('_id');

  let totalProcessed = 0;
  for (const rep of activeReports) {
    const matches = await matchForLostReport(rep._id);
    totalProcessed += matches.length;
  }
  return { reportsScanned: activeReports.length, candidatePairsUpdated: totalProcessed };
}

module.exports = {
  computePairScore,
  matchForLostReport,
  matchForFoundItem,
  runFullReconciliation,
};
