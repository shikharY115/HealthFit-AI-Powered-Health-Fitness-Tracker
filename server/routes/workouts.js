const express = require("express");
const router = express.Router();
const {
  getExerciseLibrary, addWorkout, getWorkouts, getWorkout,
  deleteWorkout, getWorkoutStats, calculateExerciseCalories
} = require("../controllers/workoutController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/library", getExerciseLibrary);
router.get("/stats", getWorkoutStats);
router.post("/calculate-calories", calculateExerciseCalories);
router.route("/").post(addWorkout).get(getWorkouts);
router.route("/:id").get(getWorkout).delete(deleteWorkout);

module.exports = router;
