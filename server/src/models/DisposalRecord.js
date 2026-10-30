const mongoose = require('mongoose');

const disposalRecordSchema = new mongoose.Schema(
  {
    disposalCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    foundItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoundItem',
      required: true,
    },
    itemCodeSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    itemNameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    categorySnapshot: {
      type: String,
      required: true,
    },
    quantityDisposed: {
      type: Number,
      default: 1,
      min: 1,
    },
    reason: {
      type: String,
      required: [true, 'Disposal or donation reason is required'],
      trim: true,
    },
    eligibilityDate: {
      type: Date,
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    disposalMethod: {
      type: String,
      enum: [
        'Donate to Campus NGO / Drive',
        'Transfer to Shared Stationery Desk',
        'Transfer to Department Lab',
        'Responsible E-Waste / Material Recycling',
        'Safe Perishable / Unsanitary Disposal',
      ],
      required: true,
    },
    recipientOrWitness: {
      organizationOrDept: { type: String, trim: true, default: 'RVCE NSS / Campus Reuse Desk' },
      witnessName: { type: String, trim: true, default: '' },
      acknowledgementNote: { type: String, trim: true, default: '' },
    },
    disposedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'disposalRecords',
  }
);

disposalRecordSchema.index({ foundItemId: 1 }, { name: 'idx_disposalRecords_foundItem' });
disposalRecordSchema.index({ disposalMethod: 1, disposedAt: -1 }, { name: 'idx_disposalRecords_method_date' });

module.exports =
  mongoose.models.DisposalRecord || mongoose.model('DisposalRecord', disposalRecordSchema);
