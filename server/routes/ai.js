const express = require("express");
const router = express.Router();
const { analyzeMeal, chat, getAIStatus, getChatHistory } = require("../controllers/aiController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/status", getAIStatus);
router.get("/history", getChatHistory);
router.post("/analyze-meal", analyzeMeal);
router.post("/chat", chat);

module.exports = router;
