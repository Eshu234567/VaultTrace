const mongoose = require('mongoose');

const campusLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    buildingZone: {
      type: String,
      required: true,
      enum: [
        'ISE & CSE Academic Cluster',
        'Central Library & Admin',
        'Student Amenities & Food Court',
        'Auditorium & Sports Complex',
        'Core Engineering Blocks',
        'Hostel & Residential Zone',
      ],
    },
    roomOrLandmark: {
      type: String,
      trim: true,
      default: '',
    },
    storageCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    defaultVaultBin: {
      type: String,
      required: true,
      trim: true,
    },
    coordinates: {
      // Normalized SVG map coordinates (0-100) for interactive campus heatmap
      x: { type: Number, default: 50 },
      y: { type: Number, default: 50 },
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'campusLocations',
  }
);

campusLocationSchema.index({ buildingZone: 1, active: 1 }, { name: 'idx_campusLocations_zone_active' });

module.exports =
  mongoose.models.CampusLocation || mongoose.model('CampusLocation', campusLocationSchema);
