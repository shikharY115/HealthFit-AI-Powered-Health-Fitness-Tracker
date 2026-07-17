/**
 * server/controllers/authController.js
 * Handles user registration, login, logout, and profile management.
 */

const User = require("../models/User");

// Helper: send JWT token as httpOnly cookie + JSON response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  const cookieOptions = {
    expires: new Date(Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000),
    httpOnly: true, // Cannot be accessed by JavaScript (XSS protection)
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  res.status(statusCode).cookie("token", token, cookieOptions).json({
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      height: user.height,
      weight: user.weight,
      age: user.age,
      gender: user.gender,
      goal: user.goal,
      activityLevel: user.activityLevel,
      dailyCalorieGoal: user.dailyCalorieGoal,
      dailyStepGoal: user.dailyStepGoal,
      darkMode: user.darkMode,
      googleFit: { connected: user.googleFit?.connected },
    },
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  const { name, email, password, height, weight, age, gender, goal, activityLevel } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Please provide name, email, and password" });
  }

  // Create user — password hashed in model pre-save hook
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    height: height || null,
    weight: weight || null,
    age: age || null,
    gender: gender || "other",
    goal: goal || "maintain",
    activityLevel: activityLevel || "moderate",
  });

  // Auto-calculate TDEE if profile data provided
  if (height && weight && age) {
    user.dailyCalorieGoal = user.calculateTDEE();
    await user.save();
  }

  sendTokenResponse(user, 201, res);
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Please provide email and password" });
  }

  // Find user with password (normally excluded)
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  sendTokenResponse(user, 200, res);
};

// @desc    Logout user (clear cookie)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000), // Expires in 10 seconds
    httpOnly: true,
  });
  res.json({ success: true, message: "Logged out successfully" });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      height: user.height,
      weight: user.weight,
      age: user.age,
      gender: user.gender,
      goal: user.goal,
      activityLevel: user.activityLevel,
      dailyCalorieGoal: user.dailyCalorieGoal,
      dailyStepGoal: user.dailyStepGoal,
      darkMode: user.darkMode,
      googleFit: { connected: user.googleFit?.connected },
    },
  });
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  const { name, height, weight, age, gender, goal, activityLevel, dailyStepGoal, darkMode } = req.body;

  const updateData = {};
  if (name) updateData.name = name.trim();
  if (height) updateData.height = height;
  if (weight) updateData.weight = weight;
  if (age) updateData.age = age;
  if (gender) updateData.gender = gender;
  if (goal) updateData.goal = goal;
  if (activityLevel) updateData.activityLevel = activityLevel;
  if (dailyStepGoal) updateData.dailyStepGoal = dailyStepGoal;
  if (typeof darkMode === "boolean") updateData.darkMode = darkMode;

  const user = await User.findByIdAndUpdate(req.user._id, updateData, {
    new: true,
    runValidators: true,
  });

  // Recalculate TDEE if relevant fields changed
  if (height || weight || age || activityLevel) {
    user.dailyCalorieGoal = user.calculateTDEE();
    await user.save();
  }

  res.json({ success: true, user, message: "Profile updated successfully" });
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Please provide current and new password" });
  }

  const user = await User.findById(req.user._id).select("+password");
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    return res.status(400).json({ success: false, message: "Current password is incorrect" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: "Password changed successfully" });
};
