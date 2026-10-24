const mongoose = require('mongoose');

const emergencyTransferSchema = new mongoose.Schema(
  {
    transferId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    requestingHospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestingHospitalName: {
      type: String,
      required: true,
    },
    requestingHospitalWallet: String,
    supplyingHospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    supplyingHospitalName: {
      type: String,
      required: true,
    },
    supplyingHospitalWallet: String,
    unitId: {
      type: String,
      required: true,
      index: true,
    },
    bloodGroup: {
      type: String,
      required: true,
    },
    componentType: {
      type: String,
      required: true,
    },
    urgency: {
      type: String,
      enum: ['CRITICAL', 'URGENT', 'LIFE_THREATENING'],
      default: 'CRITICAL',
    },
    status: {
      type: String,
      enum: ['requested', 'approved', 'dispatched', 'completed', 'rejected'],
      default: 'requested',
      index: true,
    },
    shipmentRef: String,
    reason: String,
    timestamps: {
      requestedAt: { type: Date, default: Date.now },
      approvedAt: Date,
      dispatchedAt: Date,
      completedAt: Date,
    },
    elapsedTimeMinutes: Number,
    blockchainTxHash: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmergencyTransfer', emergencyTransferSchema);
