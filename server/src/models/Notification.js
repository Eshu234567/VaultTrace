const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'MATCH_FOUND',
        'CLAIM_SUBMITTED',
        'CLAIM_APPROVED',
        'CLAIM_REJECTED',
        'CLAIM_MORE_INFO',
        'ITEM_HANDED_OVER',
        'RETENTION_ALERT',
        'SYSTEM_ALERT',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    relatedEntityType: {
      type: String,
      enum: ['LostReport', 'FoundItem', 'Claim', 'MatchCandidate', 'DisposalRecord', null],
      default: null,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    dedupeKey: {
      type: String,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    deliveryStatus: {
      type: String,
      enum: ['InApp_Delivered', 'Email_Queued', 'Failed'],
      default: 'InApp_Delivered',
    },
  },
  {
    timestamps: true,
    collection: 'notifications',
  }
);

notificationSchema.index(
  { recipientId: 1, readAt: 1, createdAt: -1 },
  { name: 'idx_notifications_recipient_read_created' }
);
notificationSchema.index({ dedupeKey: 1 }, { sparse: true, name: 'idx_notifications_dedupe' });

module.exports =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
