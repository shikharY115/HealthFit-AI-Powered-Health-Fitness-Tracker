const express = require("express");
const router = express.Router();
const {
  getGoogleAuthUrl,
  googleCallback,
  disconnectGoogleFit,
  syncGoogleFit,
  getTodaySteps,
  updateSteps,
  getStepHistory,
  debugGoogleFit,
} = require("../controllers/stepsController");
const { protect } = require("../middleware/auth");

// OAuth callback is public (Google redirects here, no JWT)
router.get("/google/callback", googleCallback);

// All other routes require authentication
router.use(protect);

router.get("/google/auth",        getGoogleAuthUrl);
router.post("/google/disconnect", disconnectGoogleFit);
router.post("/google/sync",       syncGoogleFit);
router.get("/debug",              debugGoogleFit);   // ← raw API inspection
router.get("/today",              getTodaySteps);
router.post("/update",            updateSteps);
router.get("/history",            getStepHistory);

module.exports = router;
