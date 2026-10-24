const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['USER', 'BLOOD_UNIT', 'REQUEST', 'TRANSFER', 'AUTH', 'SYSTEM'],
      required: true,
    },
    entityId: {
      type: String,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorUsername: String,
    actorRole: String,
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: String,
    blockchainTxHash: {
      type: String,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
