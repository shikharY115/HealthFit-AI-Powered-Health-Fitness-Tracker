/**
 * server/controllers/workoutController.js
 * Manages workout sessions with MET-based dynamic calorie burn calculation.
 */

const WorkoutEntry = require("../models/WorkoutEntry");
const User = require("../models/User");
const { calculateCaloriesBurned, getExerciseLibrary } = require("../utils/calorieCalculator");

const todayStr = () => new Date().toISOString().split("T")[0];

// @desc    Get exercise library (all available exercises)
// @route   GET /api/workouts/library
// @access  Private
exports.getExerciseLibrary = (req, res) => {
  res.json({ success: true, data: getExerciseLibrary() });
};

// @desc    Add a workout session
// @route   POST /api/workouts
// @access  Private
exports.addWorkout = async (req, res) => {
  const { date, sessionName, exercises, intensity, mood, notes } = req.body;

  if (!sessionName || !exercises || exercises.length === 0) {
    return res.status(400).json({
      success: false,
      message: "sessionName and at least one exercise are required",
    });
  }

  // Get user weight for calorie calculation
  const user = await User.findById(req.user._id);
  const userWeight = user?.weight || 70;

  // Calculate calories burned for each exercise dynamically
  const processedExercises = exercises.map((ex) => {
    const { caloriesBurned, metValue } = calculateCaloriesBurned(
      ex.name || ex.category,
      ex.duration || 30,
      userWeight,
      intensity === 1 || intensity === 2 ? "low" : intensity >= 4 ? "high" : "moderate"
    );

    return {
      ...ex,
      metValue,
      caloriesBurned: ex.caloriesBurned || caloriesBurned, // Use provided value if exists
    };
  });

  const entry = await WorkoutEntry.create({
    user: req.user._id,
    date: date || todayStr(),
    sessionName,
    exercises: processedExercises,
    intensity: intensity || 3,
    mood: mood || "good",
    notes,
  });

  res.status(201).json({
    success: true,
    data: entry,
    message: `Workout logged! Burned ~${entry.totalCaloriesBurned} calories 🔥`,
  });
};

// @desc    Get workout history (paginated)
// @route   GET /api/workouts?date=2024-01-15&limit=20
// @access  Private
exports.getWorkouts = async (req, res) => {
  const { date, limit = 20, page = 1 } = req.query;

  const filter = { user: req.user._id };
  if (date) filter.date = date;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await WorkoutEntry.countDocuments(filter);
  const workouts = await WorkoutEntry.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    count: workouts.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: workouts,
  });
};

// @desc    Get a specific workout session
// @route   GET /api/workouts/:id
// @access  Private
exports.getWorkout = async (req, res) => {
  const workout = await WorkoutEntry.findOne({ _id: req.params.id, user: req.user._id });
  if (!workout) return res.status(404).json({ success: false, message: "Workout not found" });
  res.json({ success: true, data: workout });
};

// @desc    Delete a workout session
// @route   DELETE /api/workouts/:id
// @access  Private
exports.deleteWorkout = async (req, res) => {
  const workout = await WorkoutEntry.findOne({ _id: req.params.id, user: req.user._id });
  if (!workout) return res.status(404).json({ success: false, message: "Workout not found" });

  await workout.deleteOne();
  res.json({ success: true, message: "Workout deleted" });
};

// @desc    Get weekly workout stats
// @route   GET /api/workouts/stats
// @access  Private
exports.getWorkoutStats = async (req, res) => {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const workouts = await WorkoutEntry.find({ user: req.user._id, date: { $in: dates } });

  const dailyStats = dates.map((date) => {
    const dayWorkouts = workouts.filter((w) => w.date === date);
    return {
      date,
      sessionCount: dayWorkouts.length,
      totalDuration: dayWorkouts.reduce((s, w) => s + (w.totalDuration || 0), 0),
      totalCaloriesBurned: Math.round(dayWorkouts.reduce((s, w) => s + (w.totalCaloriesBurned || 0), 0)),
    };
  });

  // Category breakdown for the week
  const allExercises = workouts.flatMap((w) => w.exercises);
  const categoryBreakdown = allExercises.reduce((acc, ex) => {
    acc[ex.category] = (acc[ex.category] || 0) + 1;
    return acc;
  }, {});

  res.json({
    success: true,
    data: dailyStats,
    categoryBreakdown,
    weekTotals: {
      sessions: workouts.length,
      duration: dailyStats.reduce((s, d) => s + d.totalDuration, 0),
      caloriesBurned: dailyStats.reduce((s, d) => s + d.totalCaloriesBurned, 0),
    },
  });
};

// @desc    Calculate calories for an exercise (preview before saving)
// @route   POST /api/workouts/calculate-calories
// @access  Private
exports.calculateExerciseCalories = async (req, res) => {
  const { exerciseType, durationMinutes, intensity } = req.body;

  const user = await User.findById(req.user._id);
  const userWeight = user?.weight || 70;

  const result = calculateCaloriesBurned(exerciseType, durationMinutes, userWeight, intensity);

  res.json({
    success: true,
    data: {
      ...result,
      durationMinutes,
      userWeight,
      exerciseType,
    },
  });
};
