/**
 * server/models/User.js
 * MongoDB schema for user accounts.
 * Includes bcrypt password hashing and JWT token generation.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Never return password in queries
    },
    // Profile data used for calorie burn calculations
    height: { type: Number, default: null }, // in cm
    weight: { type: Number, default: null }, // in kg
    age: { type: Number, default: null },
    gender: { type: String, enum: ["male", "female", "other"], default: "other" },
    goal: {
      type: String,
      enum: ["lose_weight", "gain_muscle", "maintain", "improve_fitness"],
      default: "maintain",
    },
    activityLevel: {
      type: String,
      enum: ["sedentary", "light", "moderate", "active", "very_active"],
      default: "moderate",
    },
    // Google Fit OAuth tokens (encrypted in production)
    googleFit: {
      accessToken:  { type: String, default: null },
      refreshToken: { type: String, default: null },
      tokenExpiry:  { type: Date,   default: null }, // when access_token expires
      connected:    { type: Boolean, default: false },
      lastSynced:   { type: Date,   default: null },
    },
    // Daily calorie goal (auto-calculated via TDEE if not set manually)
    dailyCalorieGoal: { type: Number, default: 2000 },
    dailyStepGoal: { type: Number, default: 10000 },
    // Dark mode preference
    darkMode: { type: Boolean, default: true },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// --- Pre-save Hook: Hash password before saving ---
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// --- Method: Compare entered password with hashed password ---
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// --- Method: Generate JWT token and set as httpOnly cookie ---
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// --- Method: Calculate TDEE (Total Daily Energy Expenditure) ---
UserSchema.methods.calculateTDEE = function () {
  if (!this.height || !this.weight || !this.age) return 2000;

  // Mifflin-St Jeor Equation
  let bmr;
  if (this.gender === "male") {
    bmr = 10 * this.weight + 6.25 * this.height - 5 * this.age + 5;
  } else {
    bmr = 10 * this.weight + 6.25 * this.height - 5 * this.age - 161;
  }

  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  return Math.round(bmr * (activityMultipliers[this.activityLevel] || 1.55));
};

module.exports = mongoose.model("User", UserSchema);
