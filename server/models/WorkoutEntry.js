/**
 * server/models/WorkoutEntry.js
 * Stores workout sessions for each user.
 * Tracks exercises with sets, reps, duration, and dynamic calorie burn.
 */

const mongoose = require("mongoose");

// Sub-schema for individual exercises within a workout session
const ExerciseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ["cardio", "strength", "flexibility", "hiit", "sports", "yoga", "other"],
    required: true,
  },
  duration: { type: Number, default: 0 }, // minutes
  sets: { type: Number, default: 0 },
  reps: { type: Number, default: 0 },
  weight: { type: Number, default: 0 }, // kg (for strength exercises)
  distance: { type: Number, default: 0 }, // km (for cardio)
  // MET (Metabolic Equivalent of Task) value used for dynamic calorie calc
  metValue: { type: Number, default: 3.5 },
  caloriesBurned: { type: Number, default: 0 }, // dynamically calculated
  notes: { type: String },
});

const WorkoutEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
    },
    sessionName: { type: String, required: true }, // e.g., "Morning Run", "Chest Day"
    exercises: [ExerciseSchema],
    totalDuration: { type: Number, default: 0 }, // minutes - auto-calculated
    totalCaloriesBurned: { type: Number, default: 0 }, // auto-calculated
    // Overall intensity rating (1-5)
    intensity: { type: Number, min: 1, max: 5, default: 3 },
    mood: {
      type: String,
      enum: ["great", "good", "okay", "tired", "struggling"],
      default: "good",
    },
    notes: { type: String, maxlength: 500 },
  },
  {
    timestamps: true,
  }
);

// Pre-save: aggregate totals from exercises
WorkoutEntrySchema.pre("save", function (next) {
  if (this.exercises && this.exercises.length > 0) {
    this.totalDuration = this.exercises.reduce((sum, e) => sum + (e.duration || 0), 0);
    this.totalCaloriesBurned = Math.round(
      this.exercises.reduce((sum, e) => sum + (e.caloriesBurned || 0), 0)
    );
  }
  next();
});

// Index for date-based queries
WorkoutEntrySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model("WorkoutEntry", WorkoutEntrySchema);
