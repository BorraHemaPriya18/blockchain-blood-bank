const mongoose = require('mongoose');

const bloodUnitSchema = new mongoose.Schema(
  {
    unitId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    bloodBankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bloodBankName: {
      type: String,
      required: true,
    },
    donorRefId: {
      type: String,
      required: true,
      index: true,
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: true,
      index: true,
    },
    componentType: {
      type: String,
      enum: ['Whole Blood', 'Red Blood Cells', 'Platelets', 'Plasma'],
      required: true,
      index: true,
    },
    volumeMl: {
      type: Number,
      default: 450,
    },
    collectionDate: {
      type: Date,
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
      index: true,
    },
    screeningStatus: {
      type: String,
      enum: ['pending', 'passed', 'failed'],
      default: 'pending',
    },
    screeningDetails: {
      hiv: { type: String, enum: ['Negative', 'Positive', 'Pending'], default: 'Pending' },
      hbv: { type: String, enum: ['Negative', 'Positive', 'Pending'], default: 'Pending' },
      hcv: { type: String, enum: ['Negative', 'Positive', 'Pending'], default: 'Pending' },
      syphilis: { type: String, enum: ['Negative', 'Positive', 'Pending'], default: 'Pending' },
      malaria: { type: String, enum: ['Negative', 'Positive', 'Pending'], default: 'Pending' },
      hemoglobinGdl: { type: Number, default: 14.2 },
      screenedBy: String,
      screenedAt: Date,
      notes: String,
    },
    status: {
      type: String,
      enum: [
        'collected',
        'pending_screening',
        'approved',
        'available',
        'reserved',
        'dispatched',
        'received',
        'transfused',
        'quarantined',
        'expired',
        'discarded',
      ],
      default: 'collected',
      index: true,
    },
    currentCustodian: {
      role: { type: String, enum: ['blood_bank', 'hospital', 'transit'] },
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      walletAddress: String,
    },
    reservedHospital: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      walletAddress: String,
    },
    hospitalRequestId: {
      type: String,
      index: true,
    },
    patientRefHash: {
      type: String,
    },
    shipmentDetails: {
      shipmentRef: String,
      carrier: String,
      dispatchedAt: Date,
      receivedAt: Date,
      temperatureCelsius: Number,
    },
    discardReason: {
      type: String,
    },
    discardedAt: {
      type: Date,
    },
    // Data hash stored on blockchain for integrity verification
    dataHash: {
      type: String,
      required: true,
    },
    blockchainHistory: [
      {
        eventType: { type: String, required: true },
        txHash: { type: String, required: true },
        blockNumber: Number,
        timestamp: { type: Date, default: Date.now },
        actorAddress: String,
        dataHash: String,
        remarks: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('BloodUnit', bloodUnitSchema);
