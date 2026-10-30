const mongoose = require('mongoose');

const itemEventSchema = new mongoose.Schema(
  {
    foundItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoundItem',
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventType: {
      type: String,
      enum: [
        'TIP_SUBMITTED',
        'INTAKE_STORED',
        'STORAGE_MOVED',
        'MATCH_CANDIDATE_LINKED',
        'CLAIM_SUBMITTED',
        'CLAIM_APPROVED',
        'CLAIM_REJECTED',
        'HANDOVER_COMPLETED',
        'RETENTION_REVIEW_FLAGGED',
        'DISPOSAL_EXECUTED',
        'DONATION_EXECUTED',
        'REUSE_TRANSFERRED',
        'TIME_TRAVEL_SIMULATED',
      ],
      required: true,
    },
    fromStatus: {
      type: String,
      default: null,
    },
    toStatus: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: 'itemEvents',
  }
);

itemEventSchema.index({ foundItemId: 1, timestamp: -1 }, { name: 'idx_itemEvents_item_timestamp' });

module.exports = mongoose.models.ItemEvent || mongoose.model('ItemEvent', itemEventSchema);
