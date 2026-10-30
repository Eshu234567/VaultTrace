const mongoose = require('mongoose');

const CLAIM_STATUSES = [
  'Pending',
  'More Information Required',
  'Approved',
  'Rejected',
  'Handed Over',
  'Withdrawn',
];

const claimSchema = new mongoose.Schema(
  {
    claimCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    lostReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LostReport',
      default: null,
    },
    foundItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoundItem',
      required: [true, 'Found item reference is required'],
    },
    claimantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Claimant reference is required'],
    },
    claimantName: {
      type: String,
      trim: true,
      default: '',
    },
    claimantUsn: {
      type: String,
      uppercase: true,
      trim: true,
      default: '',
    },
    // Restricted ownership verification answers - only claimant & admin can view
    claimAnswers: {
      identifyingDetailAnswer: {
        type: String,
        required: [true, 'Ownership proof answer is required'],
        trim: true,
      },
      serialOrContentsDetail: {
        type: String,
        trim: true,
        default: '',
      },
      additionalContext: {
        type: String,
        trim: true,
        default: '',
      },
    },
    proofRefs: [
      {
        url: { type: String, required: true },
        description: { type: String, default: '' },
      },
    ],
    status: {
      type: String,
      enum: CLAIM_STATUSES,
      default: 'Pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNotesPrivate: {
      type: String,
      trim: true,
      default: '',
    },
    adminFeedbackToClaimant: {
      type: String,
      trim: true,
      default: '',
    },
    handoverPassCode: {
      type: String,
      trim: true,
      default: '',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'claims',
  }
);

claimSchema.index({ foundItemId: 1, status: 1 }, { name: 'idx_claims_foundItem_status' });
claimSchema.index({ claimantId: 1, submittedAt: -1 }, { name: 'idx_claims_claimant_submitted' });

module.exports = {
  Claim: mongoose.models.Claim || mongoose.model('Claim', claimSchema),
  CLAIM_STATUSES,
};
