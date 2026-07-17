/**
 * server/models/StepsRecord.js
 * Stores daily step counts synced from wearable devices (Google Fit, etc.).
 * Architecture supports multiple fitness provider integrations.
 */

const mongoose = require("mongoose");

const StepsRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
    },
    steps: { type: Number, default: 0, min: 0 },
    // Calorie burn from steps: approx 0.04 cal/step * user weight factor
    caloriesBurned: { type: Number, default: 0 },
    // Distance in km (steps * avg_stride_length)
    distanceKm: { type: Number, default: 0 },
    // Active minutes (steps with cadence > 60 steps/min)
    activeMinutes: { type: Number, default: 0 },
    // Source of this data
    source: {
      type: String,
      enum: ["google_fit", "apple_health", "fitbit", "garmin", "manual", "device_sync"],
      default: "manual",
    },
    // Raw data from provider (for debugging and re-processing)
    rawProviderData: { type: mongoose.Schema.Types.Mixed, default: null },
    // Hourly breakdown (array of 24 values, one per hour)
    hourlySteps: [{ hour: Number, steps: Number }],
    // Goal achievement
    goalSteps: { type: Number, default: 10000 },
    goalAchieved: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// One record per user per day
StepsRecordSchema.index({ user: 1, date: 1 }, { unique: true });

// Pre-save: calculate derived values
StepsRecordSchema.pre("save", function (next) {
  // Average stride = 0.762m; calories ≈ 0.04 * steps
  this.distanceKm = Math.round((this.steps * 0.762) / 1000 * 100) / 100;
  this.caloriesBurned = Math.round(this.steps * 0.04);
  this.goalAchieved = this.steps >= (this.goalSteps || 10000);
  next();
});

module.exports = mongoose.model("StepsRecord", StepsRecordSchema);
