const mongoose = require('mongoose');

const donorProfileSchema = new mongoose.Schema(
  {
    donorRefId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: true,
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    documentUrl: {
      type: String,
    },
    photoUrl: {
      type: String,
    },
    isIdentityVerified: {
      type: Boolean,
      default: false,
    },
    verificationNotes: {
      type: String,
    },
    // Affective verification / emotion detection demonstration metadata
    affectiveCheck: {
      enabled: { type: Boolean, default: false },
      emotionDetected: { type: String, default: 'Neutral' },
      confidenceScore: { type: Number, default: 0.95 },
      underDuressFlag: { type: Boolean, default: false },
      manualConsentConfirmed: { type: Boolean, default: true },
    },
    eligibilityStatus: {
      type: String,
      enum: ['eligible', 'temporarily_deferred', 'permanently_deferred'],
      default: 'eligible',
    },
    lastDonationDate: {
      type: Date,
    },
    totalDonations: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DonorProfile', donorProfileSchema);
