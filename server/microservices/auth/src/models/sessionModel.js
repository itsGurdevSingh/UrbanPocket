import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  // Link to the User model
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Index for fast lookups
  },
  refreshToken: { type: String, required: true },
  accessToken: { type: String, required: true },
  userAgent: { type: String },
  ipAddress: { type: String },
  deviceFingerprint: { type: String },
  expiresAt: {
    type: Date,
    // Automatically delete the session document after 7 days
    default: () => new Date(Date.now() + 7*24*60*60*1000), // 7 days from now
  }
}, { timestamps: true });

// TTL Index for automatic expiration
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.model('Session', sessionSchema);

export default Session;