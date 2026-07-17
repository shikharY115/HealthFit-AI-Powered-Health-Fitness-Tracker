/**
 * server/utils/calorieCalculator.js
 * Dynamic calorie burn calculator using MET (Metabolic Equivalent of Task) values.
 * Formula: Calories = MET × weight(kg) × duration(hours)
 * Source: Compendium of Physical Activities (Ainsworth et al.)
 */

/**
 * MET values for various exercise types.
 * Higher MET = more calories burned per hour.
 * Full compendium: https://sites.google.com/site/compendiumofphysicalactivities/
 */
const MET_VALUES = {
  // Cardio
  walking_slow: 2.5,
  walking_moderate: 3.5,
  walking_fast: 4.3,
  jogging: 7.0,
  running_5kmh: 8.3,
  running_8kmh: 11.0,
  running_10kmh: 11.5,
  running_12kmh: 13.5,
  cycling_moderate: 8.0,
  cycling_fast: 12.0,
  swimming_moderate: 6.0,
  swimming_fast: 10.0,
  jump_rope: 12.3,
  elliptical: 5.0,
  rowing: 7.0,
  stair_climbing: 8.0,
  hiking: 5.3,

  // Strength Training
  weight_training_light: 3.5,
  weight_training_moderate: 5.0,
  weight_training_vigorous: 6.0,
  bodyweight: 3.8,
  powerlifting: 6.0,
  crossfit: 8.0,

  // HIIT
  hiit_moderate: 8.0,
  hiit_vigorous: 12.0,
  circuit_training: 8.0,
  tabata: 9.0,

  // Flexibility & Mind-Body
  yoga: 2.5,
  pilates: 3.0,
  stretching: 2.3,
  tai_chi: 3.0,

  // Sports
  basketball: 8.0,
  football: 8.0,
  tennis: 7.3,
  badminton: 5.5,
  cricket: 4.8,
  volleyball: 4.0,
  dancing: 5.0,
  martial_arts: 10.0,
  boxing: 9.8,
  wrestling: 7.3,

  // Default
  general_exercise: 4.0,
};

/**
 * Calculate calories burned during an exercise.
 * @param {string} exerciseType - Exercise type key from MET_VALUES
 * @param {number} durationMinutes - Duration in minutes
 * @param {number} weightKg - User's body weight in kg
 * @param {string} intensity - 'low', 'moderate', 'high'
 * @returns {object} { caloriesBurned, metValue }
 */
const calculateCaloriesBurned = (exerciseType, durationMinutes, weightKg = 70, intensity = "moderate") => {
  // Get MET value, try exact match then partial match
  let metValue = MET_VALUES[exerciseType?.toLowerCase()];

  if (!metValue) {
    // Try partial match
    const key = Object.keys(MET_VALUES).find((k) =>
      k.includes(exerciseType?.toLowerCase()) || exerciseType?.toLowerCase().includes(k.split("_")[0])
    );
    metValue = key ? MET_VALUES[key] : MET_VALUES.general_exercise;
  }

  // Adjust MET by intensity
  const intensityMultipliers = { low: 0.75, moderate: 1.0, high: 1.25 };
  metValue = metValue * (intensityMultipliers[intensity] || 1.0);

  const durationHours = durationMinutes / 60;
  const caloriesBurned = Math.round(metValue * weightKg * durationHours);

  return { caloriesBurned, metValue: Math.round(metValue * 10) / 10 };
};

/**
 * Get all available exercise types for the workout library.
 * @returns {Array} Exercise categories with options
 */
const getExerciseLibrary = () => [
  {
    category: "cardio",
    icon: "🏃",
    exercises: [
      { name: "Walking (Slow)", key: "walking_slow", unit: "minutes", metValue: 2.5 },
      { name: "Walking (Moderate)", key: "walking_moderate", unit: "minutes", metValue: 3.5 },
      { name: "Jogging", key: "jogging", unit: "minutes", metValue: 7.0 },
      { name: "Running (5 km/h)", key: "running_5kmh", unit: "minutes", metValue: 8.3 },
      { name: "Running (8 km/h)", key: "running_8kmh", unit: "minutes", metValue: 11.0 },
      { name: "Cycling (Moderate)", key: "cycling_moderate", unit: "minutes", metValue: 8.0 },
      { name: "Swimming", key: "swimming_moderate", unit: "minutes", metValue: 6.0 },
      { name: "Jump Rope", key: "jump_rope", unit: "minutes", metValue: 12.3 },
      { name: "Elliptical", key: "elliptical", unit: "minutes", metValue: 5.0 },
      { name: "Stair Climbing", key: "stair_climbing", unit: "minutes", metValue: 8.0 },
    ],
  },
  {
    category: "strength",
    icon: "💪",
    exercises: [
      { name: "Weight Training (Light)", key: "weight_training_light", unit: "minutes", metValue: 3.5 },
      { name: "Weight Training (Moderate)", key: "weight_training_moderate", unit: "minutes", metValue: 5.0 },
      { name: "Weight Training (Vigorous)", key: "weight_training_vigorous", unit: "minutes", metValue: 6.0 },
      { name: "Bodyweight Exercises", key: "bodyweight", unit: "minutes", metValue: 3.8 },
      { name: "Powerlifting", key: "powerlifting", unit: "minutes", metValue: 6.0 },
      { name: "CrossFit", key: "crossfit", unit: "minutes", metValue: 8.0 },
    ],
  },
  {
    category: "hiit",
    icon: "⚡",
    exercises: [
      { name: "HIIT (Moderate)", key: "hiit_moderate", unit: "minutes", metValue: 8.0 },
      { name: "HIIT (Vigorous)", key: "hiit_vigorous", unit: "minutes", metValue: 12.0 },
      { name: "Circuit Training", key: "circuit_training", unit: "minutes", metValue: 8.0 },
      { name: "Tabata", key: "tabata", unit: "minutes", metValue: 9.0 },
    ],
  },
  {
    category: "flexibility",
    icon: "🧘",
    exercises: [
      { name: "Yoga", key: "yoga", unit: "minutes", metValue: 2.5 },
      { name: "Pilates", key: "pilates", unit: "minutes", metValue: 3.0 },
      { name: "Stretching", key: "stretching", unit: "minutes", metValue: 2.3 },
      { name: "Tai Chi", key: "tai_chi", unit: "minutes", metValue: 3.0 },
    ],
  },
  {
    category: "sports",
    icon: "⚽",
    exercises: [
      { name: "Basketball", key: "basketball", unit: "minutes", metValue: 8.0 },
      { name: "Football/Soccer", key: "football", unit: "minutes", metValue: 8.0 },
      { name: "Tennis", key: "tennis", unit: "minutes", metValue: 7.3 },
      { name: "Badminton", key: "badminton", unit: "minutes", metValue: 5.5 },
      { name: "Cricket", key: "cricket", unit: "minutes", metValue: 4.8 },
      { name: "Boxing", key: "boxing", unit: "minutes", metValue: 9.8 },
      { name: "Martial Arts", key: "martial_arts", unit: "minutes", metValue: 10.0 },
      { name: "Dancing", key: "dancing", unit: "minutes", metValue: 5.0 },
    ],
  },
];

module.exports = { calculateCaloriesBurned, getExerciseLibrary, MET_VALUES };
