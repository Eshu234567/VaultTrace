const mongoose = require('mongoose');

const ITEM_CATEGORIES = [
  'Electronics',
  'ID / Smart Card',
  'Stationery',
  'Bottle / Flask',
  'Bag / Backpack',
  'Keys / Keychain',
  'Wallet / Purse',
  'Spectacles / Eyewear',
  'Calculator / Lab Gear',
  'Umbrella',
  'Apparel / Jacket',
  'Books / Notes',
  'Jewellery / Watch',
  'Other',
];

const REPORT_STATUSES = [
  'Active',
  'Possible Match',
  'Claim Pending',
  'Resolved',
  'Archived',
];

const lostReportSchema = new mongoose.Schema(
  {
    reportCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter reference is required'],
    },
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: 140,
    },
    category: {
      type: String,
      required: [true, 'Item category is required'],
      enum: ITEM_CATEGORIES,
    },
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
      maxlength: 1500,
    },
    attributes: {
      colour: { type: String, trim: true, default: '' },
      brand: { type: String, trim: true, default: '' },
      size: {
        type: String,
        enum: ['Pocket / Small', 'Medium / Handheld', 'Large / Carry', ''],
        default: 'Medium / Handheld',
      },
      material: { type: String, trim: true, default: '' },
      distinctiveMarks: { type: String, trim: true, default: '' },
      tags: [{ type: String, trim: true }],
    },
    lastSeen: {
      date: {
        type: Date,
        required: [true, 'Approximate date last seen is required'],
      },
      location: {
        type: String,
        required: [true, 'Campus location last seen is required'],
        trim: true,
      },
      buildingZone: {
        type: String,
        trim: true,
        default: 'Central Campus',
      },
    },
    imageRefs: [
      {
        url: { type: String, required: true },
        caption: { type: String, default: '' },
      },
    ],
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'Active',
    },
    matchedFoundItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoundItem',
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'lostReports',
  }
);

// Required DBMS Indexes per specification
lostReportSchema.index(
  { reporterId: 1, status: 1, createdAt: -1 },
  { name: 'idx_lostReports_reporter_status_created' }
);
lostReportSchema.index(
  { category: 1, status: 1, 'lastSeen.location': 1 },
  { name: 'idx_lostReports_cat_status_loc' }
);
lostReportSchema.index(
  { itemName: 'text', description: 'text', 'attributes.brand': 'text' },
  { name: 'idx_lostReports_text_search', weights: { itemName: 5, 'attributes.brand': 3, description: 1 } }
);

module.exports = {
  LostReport: mongoose.models.LostReport || mongoose.model('LostReport', lostReportSchema),
  ITEM_CATEGORIES,
  REPORT_STATUSES,
};
