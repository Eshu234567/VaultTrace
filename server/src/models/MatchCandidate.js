const mongoose = require('mongoose');

const matchCandidateSchema = new mongoose.Schema(
  {
    lostReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LostReport',
      required: true,
    },
    foundItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoundItem',
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    confidenceBand: {
      type: String,
      enum: ['High Potential Match', 'Possible Match', 'Low Match'],
      required: true,
    },
    matchedFields: [{ type: String }],
    scoreBreakdown: {
      categoryScore: { type: Number, default: 0 },     // max 25
      keywordScore: { type: Number, default: 0 },      // max 20
      attributeScore: { type: Number, default: 0 },    // max 15
      locationScore: { type: Number, default: 0 },     // max 15
      dateScore: { type: Number, default: 0 },         // max 15
      brandScore: { type: Number, default: 0 },        // max 10
    },
    explanation: {
      type: String,
      default: '',
    },
    state: {
      type: String,
      enum: ['Suggested', 'Claim Initiated', 'Confirmed Match', 'Dismissed'],
      default: 'Suggested',
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'matchCandidates',
  }
);

// Unique compound index prevents duplicate candidate pairs on repeated matching runs
matchCandidateSchema.index(
  { lostReportId: 1, foundItemId: 1 },
  { unique: true, name: 'idx_matchCandidates_pair_unique' }
);
matchCandidateSchema.index(
  { score: -1, state: 1 },
  { name: 'idx_matchCandidates_score_state' }
);

module.exports =
  mongoose.models.MatchCandidate || mongoose.model('MatchCandidate', matchCandidateSchema);
