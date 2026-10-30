const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      enum: ['student', 'staff', 'admin', 'system'],
      default: 'admin',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      enum: [
        'User',
        'LostReport',
        'FoundItem',
        'MatchCandidate',
        'Claim',
        'DisposalRecord',
        'CampusLocation',
        'DatabaseLab',
      ],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    beforeSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    afterSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    requestId: {
      type: String,
      default: () => `REQ-${Date.now().toString(36).toUpperCase()}`,
    },
  },
  {
    timestamps: false,
    collection: 'auditLogs',
  }
);

auditLogSchema.index(
  { entityType: 1, entityId: 1, timestamp: -1 },
  { name: 'idx_auditLogs_entity_timestamp' }
);
auditLogSchema.index({ actorId: 1, timestamp: -1 }, { name: 'idx_auditLogs_actor_timestamp' });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
