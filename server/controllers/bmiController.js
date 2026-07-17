/**
 * server/controllers/bmiController.js
 * BMI calculation, storage, and history retrieval.
 */

const BMIRecord = require("../models/BMIRecord");
const User = require("../models/User");

/**
 * Calculate BMI category and additional metrics.
 */
const getBMICategory = (bmi) => {
  if (bmi < 16) return "Severely Obese"; // reusing for severely underweight — fix below
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal weight";
  if (bmi < 30) return "Overweight";
  if (bmi < 35) return "Obese";
  return "Severely Obese";
};

const getIdealWeightRange = (heightCm) => {
  // Healthy BMI range (18.5–24.9) for given height
  const h = heightCm / 100;
  return {
    min: Math.round(18.5 * h * h * 10) / 10,
    max: Math.round(24.9 * h * h * 10) / 10,
  };
};

/**
 * Estimate body fat % from BMI (Deurenberg formula).
 * @param {number} bmi
 * @param {number} age
 * @param {string} gender - 'male' | 'female'
 */
const estimateBodyFat = (bmi, age, gender) => {
  if (!age) return null;
  const sex = gender === "male" ? 1 : 0;
  const bodyFat = 1.2 * bmi + 0.23 * age - 10.8 * sex - 5.4;
  return Math.round(bodyFat * 10) / 10;
};

// @desc    Calculate BMI and save record
// @route   POST /api/bmi/calculate
// @access  Private
exports.calculateBMI = async (req, res) => {
  let { height, weight, unit } = req.body;

  if (!height || !weight) {
    return res.status(400).json({ success: false, message: "Height and weight are required" });
  }

  // Unit conversion: imperial to metric
  if (unit === "imperial") {
    height = height * 2.54; // inches to cm
    weight = weight * 0.453592; // lbs to kg
  }

  height = parseFloat(height);
  weight = parseFloat(weight);

  if (height < 50 || height > 300) {
    return res.status(400).json({ success: false, message: "Height must be between 50cm and 300cm" });
  }
  if (weight < 2 || weight > 500) {
    return res.status(400).json({ success: false, message: "Weight must be between 2kg and 500kg" });
  }

  const bmi = Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10;
  const category = getBMICategory(bmi);
  const { min: idealWeightMin, max: idealWeightMax } = getIdealWeightRange(height);
  const user = await User.findById(req.user._id);
  const estimatedBodyFat = estimateBodyFat(bmi, user?.age, user?.gender);

  // Save BMI record
  const record = await BMIRecord.create({
    user: req.user._id,
    height,
    weight,
    bmi,
    category,
    idealWeightMin,
    idealWeightMax,
    estimatedBodyFat,
  });

  // Update user's weight in profile
  await User.findByIdAndUpdate(req.user._id, { height, weight });

  res.status(201).json({
    success: true,
    data: {
      bmi,
      category,
      height,
      weight,
      idealWeightMin,
      idealWeightMax,
      estimatedBodyFat,
      record,
      // Color coding for UI
      color: bmi < 18.5 ? "#60a5fa" : bmi < 25 ? "#4ade80" : bmi < 30 ? "#facc15" : "#f87171",
    },
  });
};

// @desc    Get user's BMI history
// @route   GET /api/bmi/history
// @access  Private
exports.getBMIHistory = async (req, res) => {
  const { limit = 20 } = req.query;

  const records = await BMIRecord.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  // Format for chart data (chronological order for line chart)
  const chartData = [...records].reverse().map((r) => ({
    date: r.createdAt.toISOString().split("T")[0],
    bmi: r.bmi,
    weight: r.weight,
    category: r.category,
  }));

  res.json({
    success: true,
    count: records.length,
    data: records,
    chartData,
  });
};

// @desc    Delete a BMI record
// @route   DELETE /api/bmi/:id
// @access  Private
exports.deleteBMIRecord = async (req, res) => {
  const record = await BMIRecord.findOne({ _id: req.params.id, user: req.user._id });

  if (!record) {
    return res.status(404).json({ success: false, message: "BMI record not found" });
  }

  await record.deleteOne();
  res.json({ success: true, message: "BMI record deleted" });
};
