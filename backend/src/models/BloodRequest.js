const mongoose = require('mongoose');

const bloodRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hospitalName: {
      type: String,
      required: true,
    },
    hospitalWallet: {
      type: String,
    },
    bloodBankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    bloodBankName: {
      type: String,
      trim: true,
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: true,
    },
    componentType: {
      type: String,
      enum: ['Whole Blood', 'Red Blood Cells', 'Platelets', 'Plasma'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    urgency: {
      type: String,
      enum: ['normal', 'urgent', 'emergency'],
      default: 'normal',
    },
    patientRefId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'fulfilled', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    allocatedUnits: [
      {
        type: String,
        trim: true,
      },
    ],
    requiredByDate: {
      type: Date,
    },
    remarks: String,
    rejectionReason: String,
    blockchainTxHash: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);
