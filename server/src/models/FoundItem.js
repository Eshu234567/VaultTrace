const mongoose = require('mongoose');
const { ITEM_CATEGORIES } = require('./LostReport');

const FOUND_STATUSES = [
  'Pending Verification', // Student-submitted Found Tip awaiting Staff/Admin intake
  'Stored',               // Verified in physical campus vault bin
  'Claim Pending',        // Active claim under review
  'Approved',             // Claim approved, awaiting physical handover
  'Returned',             // Handed over to verified owner
  'Disposal Review',      // Retention period elapsed, awaiting admin review
  'Donated',              // Transferred to charity / reuse drive
  'Disposed',             // Responsibly recycled or disposed
];

const RETENTION_CLASSES = [
  'Small / Low-Value',
  'Standard',
  'High-Value / Sensitive',
  'Perishable / Unsafe',
];

const foundItemSchema = new mongoose.Schema(
  {
    itemCode: {
      type: String,
      required: [true, 'Unique Item ID / Tag Code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    submittedByRole: {
      type: String,
      enum: ['student', 'staff', 'admin'],
      default: 'staff',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ITEM_CATEGORIES,
    },
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: 140,
    },
    description: {
      type: String,
      required: [true, 'Public description is required'],
      trim: true,
      maxlength: 1500,
    },
    visibleAttributes: {
      colour: { type: String, trim: true, default: '' },
      brand: { type: String, trim: true, default: '' },
      size: {
        type: String,
        enum: ['Pocket / Small', 'Medium / Handheld', 'Large / Carry', ''],
        default: 'Medium / Handheld',
      },
      material: { type: String, trim: true, default: '' },
      tags: [{ type: String, trim: true }],
    },
    // Restricted ownership clues - NEVER returned to students or public listings
    restrictedProof: {
      serialOrIdFragment: { type: String, trim: true, default: '' },
      hiddenMarkOrScratch: { type: String, trim: true, default: '' },
      lockedScreenOrContents: { type: String, trim: true, default: '' },
      verificationPrompt: {
        type: String,
        trim: true,
        default: 'Describe any unique identifying mark, contents, or serial digits on the item.',
      },
    },
    foundAt: {
      type: Date,
      required: [true, 'Found date/time is required'],
    },
    foundLocation: {
      type: String,
      required: [true, 'Found location is required'],
      trim: true,
    },
    foundBuildingZone: {
      type: String,
      trim: true,
      default: 'Central Campus',
    },
    // Restricted exact physical vault storage coordinate
    storageLocation: {
      type: String,
      required: [true, 'Physical storage bin/location is required'],
      trim: true,
      default: 'Vault Intake Tray #01',
    },
    finderDetails: {
      finderName: { type: String, trim: true, default: 'Anonymous Campus Member' },
      finderContact: { type: String, trim: true, default: '' },
    },
    status: {
      type: String,
      enum: FOUND_STATUSES,
      default: 'Stored',
    },
    estimatedValueBand: {
      type: String,
      enum: ['Low (< ₹500)', 'Medium (₹500 - ₹3,000)', 'High (> ₹3,000)'],
      default: 'Medium (₹500 - ₹3,000)',
    },
    retentionClass: {
      type: String,
      enum: RETENTION_CLASSES,
      default: 'Standard',
    },
    retentionDays: {
      type: Number,
      default: 90,
      min: 0,
    },
    eligibleForDisposalAt: {
      type: Date,
      required: true,
    },
    policyVersion: {
      type: String,
      default: 'v2025.1-RVCE',
    },
    isBatchStationery: {
      type: Boolean,
      default: false,
    },
    batchQuantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    batchLabel: {
      type: String,
      trim: true,
      default: '',
    },
    claimFreeze: {
      type: Boolean,
      default: false,
    },
    returnedAt: {
      type: Date,
      default: null,
    },
    handoverDetails: {
      recipientName: { type: String, default: '' },
      recipientIdentifier: { type: String, default: '' },
      verifiedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      handoverCondition: { type: String, default: '' },
      handoverNotes: { type: String, default: '' },
      handedOverAt: { type: Date, default: null },
    },
    imageRefs: [
      {
        url: { type: String, required: true },
        caption: { type: String, default: '' },
      },
    ],
  },
  {
    timestamps: true,
    collection: 'foundItems',
  }
);

// Required DBMS Indexes per specification
foundItemSchema.index({ status: 1, category: 1, foundAt: -1 }, { name: 'idx_foundItems_status_cat_foundAt' });
foundItemSchema.index({ storageLocation: 1, status: 1 }, { name: 'idx_foundItems_storage_status' });
foundItemSchema.index({ eligibleForDisposalAt: 1, status: 1 }, { name: 'idx_foundItems_retention_due' });
foundItemSchema.index(
  { itemName: 'text', description: 'text', 'visibleAttributes.brand': 'text' },
  { name: 'idx_foundItems_text_search', weights: { itemName: 5, 'visibleAttributes.brand': 3, description: 1 } }
);

module.exports = {
  FoundItem: mongoose.models.FoundItem || mongoose.model('FoundItem', foundItemSchema),
  FOUND_STATUSES,
  RETENTION_CLASSES,
};
