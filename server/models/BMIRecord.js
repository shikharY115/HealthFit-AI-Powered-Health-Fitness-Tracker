/**
 * server/models/BMIRecord.js
 * Stores individual BMI calculation records for each user.
 */

const mongoose = require("mongoose");

const BMIRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    height: { type: Number, required: true }, // cm
    weight: { type: Number, required: true }, // kg
    bmi: { type: Number, required: true },
    category: {
      type: String,
      enum: ["Underweight", "Normal weight", "Overweight", "Obese", "Severely Obese"],
      required: true,
    },
    // Ideal weight range for user's height
    idealWeightMin: { type: Number },
    idealWeightMax: { type: Number },
    // Body fat percentage (approximate, based on BMI)
    estimatedBodyFat: { type: Number },
    note: { type: String, maxlength: 200 },
  },
  {
    timestamps: true,
  }
);

// Index for efficient user + date queries
BMIRecordSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("BMIRecord", BMIRecordSchema);
