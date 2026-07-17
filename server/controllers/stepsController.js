/**
 * server/controllers/stepsController.js
 * Step tracking with Google Fit OAuth integration.
 *
 * Google Fit Integration Flow:
 * 1. User clicks "Connect Google Fit" → GET /api/steps/google/auth
 * 2. Google redirects to callback → GET /api/steps/google/callback
 * 3. App stores OAuth tokens in user document
 * 4. GET /api/steps/today auto-fetches from Google Fit if connected
 *
 * FIX LOG (2026-04-21):
 * - Added automatic token refresh when access_token expires
 * - Fixed step value parsing (intVal OR fpVal per Google Fit spec)
 * - Added detailed console logging for debugging API responses
 * - Fixed findOneAndUpdate → save() so pre-save hooks run (calorie/distance calc)
 * - Added "sync now" endpoint that forces a fresh Google Fit pull
 * - Widened time window to full UTC day to avoid timezone step misses
 */

const StepsRecord = require("../models/StepsRecord");
const User = require("../models/User");
const { google } = require("googleapis");
const fetch = require("node-fetch");

const todayStr = () => new Date().toISOString().split("T")[0];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create Google OAuth2 client from environment variables.
 * Returns null if Google Fit is not configured.
 */
const getOAuth2Client = () => {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID === "your_google_client_id"
  ) {
    return null;
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:5000/api/steps/google/callback"
  );
};

/**
 * Build today's time range in milliseconds.
 * Uses local midnight → current time to match device behaviour.
 * Also builds a full-day UTC window as fallback.
 */
const getTodayTimeRange = () => {
  const now = new Date();

  // Local midnight — matches what Google Fit app shows on the device
  const localMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0, 0, 0, 0
  );

  const startMs = localMidnight.getTime();
  const endMs   = now.getTime();

  return {
    // NOTE: Google Fit aggregate API requires these as strings in the JSON body
    startTimeMillis: startMs.toString(),
    endTimeMillis:   endMs.toString(),
    // Raw numbers needed for direct HTTP calls
    startMs,
    endMs,
    startHuman: localMidnight.toISOString(),
    endHuman:   now.toISOString(),
  };
};

/**
 * Parse step value from a Google Fit data point value.
 * Google Fit returns steps as intVal, but some data sources use fpVal.
 */
const parseStepVal = (val) => {
  if (val.intVal !== undefined && val.intVal !== null) return val.intVal;
  if (val.fpVal !== undefined && val.fpVal !== null) return Math.round(val.fpVal);
  return 0;
};

/**
 * Check if the stored access token is expired or about to expire.
 * Returns true if token should be refreshed proactively.
 */
const isTokenExpiredOrExpiring = (tokenExpiry) => {
  if (!tokenExpiry) return true; // No expiry stored — assume expired
  const expiryDate = new Date(tokenExpiry);
  const now = new Date();
  // Refresh 5 minutes before actual expiry to avoid mid-request failures
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= (expiryDate.getTime() - bufferMs);
};

/**
 * Detect if an error is an authentication/authorization error from Google.
 */
const isGoogleAuthError = (err) => {
  const msg = (err.message || '').toLowerCase();
  const code = err.code || err.status || (err.response?.status);
  return (
    code === 401 ||
    code === 403 ||
    msg.includes('invalid_grant') ||
    msg.includes('token has been expired') ||
    msg.includes('token has been revoked') ||
    msg.includes('invalid credentials') ||
    msg.includes('invalid_token') ||
    msg.includes('unauthorized') ||
    msg.includes('access token') ||
    msg.includes('auth error') ||
    msg.includes('login required')
  );
};

/**
 * Attempt to refresh the access token and persist it.
 * Uses explicit HTTP POST to oauth2.googleapis.com/token.
 * Returns new access token on success, null on failure.
 */
const refreshAccessToken = async (oauth2Client, userId, refreshToken) => {
  if (!refreshToken) {
    console.warn("[GoogleFit] No refresh token stored — cannot refresh. User must reconnect.");
    return null;
  }
  
  console.log("[GoogleFit] Attempting token refresh for user:", userId);
  const startTime = Date.now();
  
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      console.error(`[GoogleFit] Token refresh FAILED (${response.status}) in ${elapsed}ms:`, data);
      // If refresh token itself is invalid, mark connection as broken
      if (data.error === 'invalid_grant') {
        console.error("[GoogleFit] Refresh token revoked/invalid. User must reconnect.");
        await User.findByIdAndUpdate(userId, { "googleFit.connected": false });
      }
      return null;
    }

    console.log(`[GoogleFit] Token refreshed successfully in ${elapsed}ms. New token expires in ${data.expires_in}s.`);

    // Update oauth2Client credentials
    oauth2Client.setCredentials({ 
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken
    });

    // Persist new tokens to DB
    const updateData = {
      "googleFit.accessToken": data.access_token,
    };
    
    if (data.refresh_token) {
      updateData["googleFit.refreshToken"] = data.refresh_token;
      console.log("[GoogleFit] New refresh token received and stored.");
    }
    
    if (data.expires_in) {
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + data.expires_in);
      updateData["googleFit.tokenExpiry"] = expiryDate;
    }

    await User.findByIdAndUpdate(userId, updateData);
    return data.access_token;
  } catch (err) {
    console.error("[GoogleFit] Token refresh network error:", err.message);
    return null;
  }
};

/**
 * Core Google Fit step fetch.
 * 1. Proactively refreshes token if expired/expiring (avoids 401 entirely)
 * 2. If API call still fails with auth error, retries once with fresh token
 *
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {string} userId - MongoDB user _id (for persisting refreshed token)
 * @param {Date|null} tokenExpiry - stored expiry date of current access token
 * @returns {number|null} total steps today, or null on unrecoverable error
 */
const fetchStepsFromGoogleFit = async (accessToken, refreshToken, userId, tokenExpiry) => {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;

  const timeRange = getTodayTimeRange();
  console.log("[GoogleFit] Fetching steps for user:", userId);
  console.log("[GoogleFit] Time range:", timeRange.startHuman, "→", timeRange.endHuman);

  // ── Step 1: Proactive token refresh if expired/expiring ──
  let currentToken = accessToken;
  if (isTokenExpiredOrExpiring(tokenExpiry)) {
    console.log("[GoogleFit] Token expired or expiring soon — refreshing proactively...");
    const newToken = await refreshAccessToken(oauth2Client, userId, refreshToken);
    if (newToken) {
      currentToken = newToken;
      console.log("[GoogleFit] Proactive refresh succeeded.");
    } else {
      console.warn("[GoogleFit] Proactive refresh failed — will try with existing token.");
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Core HTTP helper — sends one aggregate request, returns steps
  // ─────────────────────────────────────────────────────────────
  const aggregateRequest = async (token, body, label) => {
    console.log(`[GoogleFit][${label}] Request:`, JSON.stringify(body, null, 2));

    const resp = await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    console.log("HIT THIS BLOCK");
    const respBody = await resp.json();
    console.log(`[GoogleFit][${label}] HTTP status:`, resp.status);
    console.log(`[GoogleFit][${label}] Full response:`, JSON.stringify(respBody, null, 2));

    if (!resp.ok) {
      // Classify the error
      if (resp.status === 401) {
        console.error(`[GoogleFit][${label}] ❌ 401 UNAUTHORIZED — access token is invalid or expired.`);
      } else if (resp.status === 403) {
        console.error(`[GoogleFit][${label}] ❌ 403 FORBIDDEN — missing OAuth scope. Ensure fitness.activity.read is granted.`);
      } else {
        console.error(`[GoogleFit][${label}] ❌ HTTP ${resp.status}:`, JSON.stringify(respBody, null, 2));
      }
      const err = new Error(respBody?.error?.message || `HTTP ${resp.status}`);
      err.code   = resp.status;
      err.status = resp.status;
      throw err;
    }

    const buckets = respBody.bucket || [];
    console.log(`[GoogleFit][${label}] Buckets:`, buckets.length);

    let total = 0;
    for (const bucket of buckets) {
      for (const dataset of bucket.dataset || []) {
        const pts = dataset.point?.length ?? 0;
        console.log(`[GoogleFit][${label}]  dataset=${dataset.dataSourceId} points=${pts}`);
        for (const point of dataset.point || []) {
          for (const val of point.value || []) {
            const steps = parseStepVal(val);
            console.log(`[GoogleFit][${label}]   val=${JSON.stringify(val)} → ${steps} steps`);
            total += steps;
          }
        }
      }
    }

    console.log(`[GoogleFit][${label}] ✅ Total:`, total, "steps");
    return { total, buckets };
  };

  // ─────────────────────────────────────────────────────────────
  // Strategy runner — tries all sources, returns first non-null
  // ─────────────────────────────────────────────────────────────
  const doFetchDirect = async (token) => {
    // ── Strategy 1: aggregate by dataTypeName (standard) ──────────────────
    console.log("[GoogleFit] Strategy 1: dataTypeName=com.google.step_count.delta (today)");
    const s1 = await aggregateRequest(token, {
      aggregateBy:   [{ dataTypeName: "com.google.step_count.delta" }],
      bucketByTime:  { durationMillis: 86400000 },
      startTimeMillis: timeRange.startMs,
      endTimeMillis:   timeRange.endMs,
    }, "S1-typename-today");

    if (s1.total > 0) {
      console.log("[GoogleFit] Strategy 1 succeeded:", s1.total, "steps");
      return s1.total;
    }

    // ── Strategy 2: aggregate by specific estimated_steps dataSourceId ─────
    console.log("[GoogleFit] Strategy 2: dataSourceId=estimated_steps (today)");
    try {
      const s2 = await aggregateRequest(token, {
        aggregateBy: [{
          dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps"
        }],
        bucketByTime:  { durationMillis: 86400000 },
        startTimeMillis: timeRange.startMs,
        endTimeMillis:   timeRange.endMs,
      }, "S2-estimated-today");

      if (s2.total > 0) {
        console.log("[GoogleFit] Strategy 2 succeeded:", s2.total, "steps");
        return s2.total;
      }
    } catch (s2err) {
      console.warn("[GoogleFit] Strategy 2 failed:", s2err.message);
    }

    // ── Strategy 3: 7-day range timezone sanity check ──────────────────────
    // If today returns 0 but 7 days has data → time calculation is wrong
    console.log("[GoogleFit] Strategy 3: dataTypeName, last 7 days (timezone test)");
    const sevenDaysAgo = timeRange.endMs - (7 * 24 * 60 * 60 * 1000);
    try {
      const s3 = await aggregateRequest(token, {
        aggregateBy:   [{ dataTypeName: "com.google.step_count.delta" }],
        bucketByTime:  { durationMillis: 86400000 },
        startTimeMillis: sevenDaysAgo,
        endTimeMillis:   timeRange.endMs,
      }, "S3-typename-7d");

      if (s3.total > 0) {
        console.warn(
          `[GoogleFit] ⚠️ Strategy 3 found ${s3.total} steps over 7 days but today=0.`,
          "This likely means today's steps haven't synced to Google Fit yet,",
          "or there is a timezone offset issue with the start-of-day calculation."
        );
        // Don't return 7-day total as today's steps — return 0 with a clear log
        return 0;
      }
    } catch (s3err) {
      console.warn("[GoogleFit] Strategy 3 failed:", s3err.message);
    }

    // ── All strategies returned 0: check dataSources for diagnosis ─────────
    console.warn("[GoogleFit] All strategies returned 0 steps. Inspecting data sources...");
    try {
      const dsResp = await fetch(
        "https://www.googleapis.com/fitness/v1/users/me/dataSources",
        { headers: { "Authorization": `Bearer ${token}` } }
      );
      const dsBody = await dsResp.json();
      const allSources = dsBody.dataSource || [];
      const stepSources = allSources.filter(ds => ds.dataType?.name?.includes("step"));
      console.log("[GoogleFit] Total data sources:", allSources.length);
      console.log("[GoogleFit] Step data sources:", stepSources.length);
      stepSources.forEach(ds =>
        console.log("[GoogleFit]  →", ds.dataStreamId, "|", ds.dataType?.name)
      );
      if (stepSources.length === 0) {
        console.error("[GoogleFit] ❌ No step data sources found. The Google account has no step data at all.");
      } else {
        console.warn("[GoogleFit] Step sources exist but returned 0 steps. Data may not have synced yet from the device.");
      }
    } catch (dsErr) {
      console.warn("[GoogleFit] Could not check data sources:", dsErr.message);
    }

    return 0;
  };

  // ── Step 2: Fetch with current token (direct HTTP — avoids library quirks) ──
  try {
    const steps = await doFetchDirect(currentToken);
    return { steps, error: null, errorCode: null };
  } catch (err) {
    console.warn("[GoogleFit] First fetch failed:", err.code || err.status || '', err.message);

    if (!isGoogleAuthError(err)) {
      const code = err.code || err.status;
      const errorCode = code === 403 ? 'scope' : 'network';
      console.error("[GoogleFit] Non-auth error — giving up. Full error:", err.message);
      return { steps: null, error: err.message, errorCode };
    }

    // ── Step 3: Retry once with freshly refreshed token ──
    console.log("[GoogleFit] Auth error detected — refreshing token and retrying...");
    const freshToken = await refreshAccessToken(oauth2Client, userId, refreshToken);
    if (!freshToken) {
      console.error("[GoogleFit] Token refresh failed — user must reconnect Google Fit.");
      return { steps: null, error: 'Token refresh failed', errorCode: 'auth' };
    }

    try {
      const steps = await doFetchDirect(freshToken);
      return { steps, error: null, errorCode: null };
    } catch (retryErr) {
      console.error("[GoogleFit] Retry after refresh also failed:", retryErr.code || retryErr.status || '', retryErr.message);
      return { steps: null, error: retryErr.message, errorCode: 'auth' };
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get Google Fit OAuth URL
// @route   GET /api/steps/google/auth
// @access  Private
exports.getGoogleAuthUrl = (req, res) => {
  const oauth2Client = getOAuth2Client();

  if (!oauth2Client) {
    return res.status(501).json({
      success: false,
      message:
        "Google Fit integration not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env",
      setup: {
        step1: "Go to https://console.cloud.google.com/",
        step2: "Create a project → Enable 'Fitness API'",
        step3: "Create OAuth 2.0 credentials (Web Application)",
        step4:
          "Add redirect URI: http://localhost:5000/api/steps/google/callback",
        step5: "Copy Client ID and Secret to your .env file",
      },
    });
  }

  const scopes = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.body.read",
  ];

  const state = Buffer.from(req.user._id.toString()).toString("base64");

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state,
    prompt: "consent", // force refresh_token on every connect
  });

  console.log("[GoogleFit] Generated auth URL for user:", req.user._id);
  res.json({ success: true, data: { authUrl } });
};

// @desc    Google Fit OAuth callback
// @route   GET /api/steps/google/callback
// @access  Public (Google redirects here)
exports.googleCallback = async (req, res) => {
  const { code, state, error } = req.query;

  // Support both dev ports
  const clientUrl =
    process.env.CLIENT_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:5174"
      : "http://localhost:5173");

  if (error) {
    console.warn("[GoogleFit] OAuth denied:", error);
    return res.redirect(`${clientUrl}/steps?error=google_fit_denied`);
  }

  if (!code || !state) {
    return res.redirect(`${clientUrl}/steps?error=invalid_callback`);
  }

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.redirect(`${clientUrl}/steps?error=not_configured`);
  }

  try {
    const userId = Buffer.from(state, "base64").toString("utf8");
    const { tokens } = await oauth2Client.getToken(code);

    console.log("[GoogleFit] Tokens received for user:", userId);
    console.log("[GoogleFit] Has refresh_token:", !!tokens.refresh_token);
    console.log("[GoogleFit] Token expiry:", tokens.expiry_date);

    if (!tokens.refresh_token) {
      console.warn(
        "[GoogleFit] WARNING: No refresh_token received. " +
        "User may need to revoke access at https://myaccount.google.com/permissions and reconnect."
      );
    }

    await User.findByIdAndUpdate(userId, {
      "googleFit.accessToken": tokens.access_token,
      "googleFit.refreshToken": tokens.refresh_token || null,
      "googleFit.tokenExpiry": tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null,
      "googleFit.connected": true,
      "googleFit.lastSynced": new Date(),
    });

    res.redirect(`${clientUrl}/steps?success=google_fit_connected`);
  } catch (err) {
    console.error("[GoogleFit] OAuth callback error:", err.message);
    res.redirect(`${clientUrl}/steps?error=auth_failed`);
  }
};

// @desc    Disconnect Google Fit
// @route   POST /api/steps/google/disconnect
// @access  Private
exports.disconnectGoogleFit = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    "googleFit.accessToken": null,
    "googleFit.refreshToken": null,
    "googleFit.connected": false,
    "googleFit.tokenExpiry": null,
  });

  console.log("[GoogleFit] Disconnected for user:", req.user._id);
  res.json({ success: true, message: "Google Fit disconnected" });
};

// @desc    Get today's step count (from Google Fit or manual)
// @route   GET /api/steps/today
// @access  Private
exports.getTodaySteps = async (req, res) => {
  const today = todayStr();
  const user = await User.findById(req.user._id);

  let googleFitConnected = user?.googleFit?.connected || false;
  let syncError = null;

  // ── Attempt Google Fit sync ──
  if (googleFitConnected && user.googleFit?.accessToken) {
    console.log("[Steps] Attempting Google Fit sync for:", req.user._id);

    const result = await fetchStepsFromGoogleFit(
      user.googleFit.accessToken,
      user.googleFit.refreshToken,
      req.user._id,
      user.googleFit.tokenExpiry
    );

    const googleSteps = result?.steps;
    const fetchError  = result?.errorCode;

    if (googleSteps !== null && googleSteps !== undefined) {
      // Use save() instead of findOneAndUpdate so pre-save hooks run
      let record = await StepsRecord.findOne({ user: req.user._id, date: today });

      if (!record) {
        record = new StepsRecord({
          user: req.user._id,
          date: today,
          goalSteps: user.dailyStepGoal || 10000,
        });
      }

      record.steps = googleSteps;
      record.source = "google_fit";
      record.goalSteps = user.dailyStepGoal || 10000;
      record.rawProviderData = { synced: new Date(), stepsRaw: googleSteps };

      await record.save(); // triggers pre-save: calorie/distance/goalAchieved

      await User.findByIdAndUpdate(req.user._id, {
        "googleFit.lastSynced": new Date(),
      });

      console.log(
        `[Steps] Synced ${googleSteps} steps from Google Fit for user ${req.user._id}`
      );
    } else {
      // Re-read user to check if connection was marked broken during refresh
      const updatedUser = await User.findById(req.user._id);
      if (!updatedUser?.googleFit?.connected) {
        syncError = "Google Fit token expired. Please reconnect Google Fit.";
        googleFitConnected = false;
      } else if (fetchError === 'scope') {
        syncError = "Google Fit access denied (missing scope). Please reconnect and grant Fitness API permission.";
      } else if (fetchError === 'auth') {
        syncError = "Google Fit session expired. Please reconnect Google Fit.";
        googleFitConnected = false;
      } else {
        syncError = "Google Fit sync failed. Will retry automatically on next request.";
      }
      console.warn("[Steps]", syncError);
    }
  }

  // ── Get the stored record (upserted above or manual) ──
  let record = await StepsRecord.findOne({ user: req.user._id, date: today });

  if (!record) {
    record = new StepsRecord({
      user: req.user._id,
      date: today,
      steps: 0,
      source: "manual",
      goalSteps: user?.dailyStepGoal || 10000,
    });
    await record.save();
  }

  res.json({
    success: true,
    data: {
      ...record.toObject(),
      googleFitConnected,
      lastSynced: user?.googleFit?.lastSynced,
      syncError: syncError || undefined,
    },
  });
};

// @desc    Force sync with Google Fit right now
// @route   POST /api/steps/google/sync
// @access  Private
exports.syncGoogleFit = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user?.googleFit?.connected || !user?.googleFit?.accessToken) {
    return res.status(400).json({
      success: false,
      message: "Google Fit is not connected",
    });
  }

  const result = await fetchStepsFromGoogleFit(
    user.googleFit.accessToken,
    user.googleFit.refreshToken,
    req.user._id,
    user.googleFit.tokenExpiry
  );

  const googleSteps = result?.steps;
  const fetchError  = result?.errorCode;

  if (googleSteps === null || googleSteps === undefined) {
    // Re-read user to check if refresh token was invalidated
    const updatedUser = await User.findById(req.user._id);
    const needsReconnect = !updatedUser?.googleFit?.connected || fetchError === 'auth';

    let message;
    if (needsReconnect) {
      message = "Google Fit token revoked or expired. Please disconnect and reconnect Google Fit.";
    } else if (fetchError === 'scope') {
      message = "Google Fit access denied — missing Fitness API scope. Please reconnect and grant all requested permissions.";
    } else {
      message = "Failed to fetch from Google Fit. Check that the Fitness API is enabled in Google Cloud Console.";
    }

    return res.status(502).json({
      success: false,
      message,
      needsReconnect,
      errorCode: fetchError,
    });
  }

  const today = todayStr();
  let record = await StepsRecord.findOne({ user: req.user._id, date: today });

  if (!record) {
    record = new StepsRecord({
      user: req.user._id,
      date: today,
      goalSteps: user.dailyStepGoal || 10000,
    });
  }

  record.steps = googleSteps;
  record.source = "google_fit";
  record.goalSteps = user.dailyStepGoal || 10000;
  record.rawProviderData = { synced: new Date(), stepsRaw: googleSteps };
  await record.save();

  await User.findByIdAndUpdate(req.user._id, {
    "googleFit.lastSynced": new Date(),
  });

  console.log(`[Steps] Force sync: ${googleSteps} steps for user ${req.user._id}`);

  res.json({
    success: true,
    message: `Synced ${googleSteps.toLocaleString()} steps from Google Fit`,
    data: record,
  });
};

// @desc    Update step count manually
// @route   POST /api/steps/update
// @access  Private
exports.updateSteps = async (req, res) => {
  const { steps, date, source = "manual", hourlySteps } = req.body;

  if (steps === undefined || steps < 0) {
    return res.status(400).json({
      success: false,
      message: "Valid step count is required",
    });
  }

  const user = await User.findById(req.user._id);

  let record = await StepsRecord.findOne({
    user: req.user._id,
    date: date || todayStr(),
  });

  if (!record) {
    record = new StepsRecord({
      user: req.user._id,
      date: date || todayStr(),
      goalSteps: user?.dailyStepGoal || 10000,
    });
  }

  record.steps = parseInt(steps);
  record.source = source;
  record.goalSteps = user?.dailyStepGoal || 10000;
  if (hourlySteps) record.hourlySteps = hourlySteps;

  await record.save(); // triggers pre-save hooks

  res.json({ success: true, data: record });
};

// @desc    Get weekly step history
// @route   GET /api/steps/history
// @access  Private
exports.getStepHistory = async (req, res) => {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const records = await StepsRecord.find({
    user: req.user._id,
    date: { $in: dates },
  });

  const data = dates.map((date) => {
    const record = records.find((r) => r.date === date);
    return {
      date,
      steps: record?.steps || 0,
      caloriesBurned: record?.caloriesBurned || 0,
      distanceKm: record?.distanceKm || 0,
      goalAchieved: record?.goalAchieved || false,
      source: record?.source || "none",
    };
  });

  res.json({ success: true, data });
};

// @desc    Debug endpoint — returns raw Google Fit API responses for inspection
// @route   GET /api/steps/debug
// @access  Private
exports.debugGoogleFit = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user?.googleFit?.connected || !user?.googleFit?.accessToken) {
    return res.status(400).json({
      success: false,
      message: "Google Fit is not connected. Connect first via /api/steps/google/auth",
    });
  }

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.status(501).json({ success: false, message: "Google Fit not configured in .env" });
  }

  // Proactively refresh token if needed
  let token = user.googleFit.accessToken;
  if (isTokenExpiredOrExpiring(user.googleFit.tokenExpiry)) {
    const newToken = await refreshAccessToken(oauth2Client, req.user._id, user.googleFit.refreshToken);
    if (newToken) token = newToken;
  }

  const timeRange = getTodayTimeRange();
  const sevenDaysAgo = timeRange.endMs - (7 * 24 * 60 * 60 * 1000);
  const results = {};

  // Helper: safe fetch + json
  const safeFetch = async (url, opts) => {
    try {
      const r = await fetch(url, opts);
      const body = await r.json();
      return { status: r.status, ok: r.ok, body };
    } catch (e) {
      return { status: 0, ok: false, error: e.message };
    }
  };

  // 1. Strategy 1 — dataTypeName today
  results.strategy1_typename_today = await safeFetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: timeRange.startMs,
        endTimeMillis:   timeRange.endMs,
      }),
    }
  );

  // 2. Strategy 2 — estimated_steps dataSourceId today
  results.strategy2_estimated_today = await safeFetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregateBy: [{
          dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps"
        }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: timeRange.startMs,
        endTimeMillis:   timeRange.endMs,
      }),
    }
  );

  // 3. Strategy 3 — dataTypeName last 7 days
  results.strategy3_typename_7days = await safeFetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: sevenDaysAgo,
        endTimeMillis:   timeRange.endMs,
      }),
    }
  );

  // 4. Data sources list
  results.dataSources = await safeFetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataSources",
    { headers: { "Authorization": `Bearer ${token}` } }
  );

  // Summarise what we found
  const summary = {
    timeRange: {
      startMs: timeRange.startMs,
      endMs:   timeRange.endMs,
      startISO: timeRange.startHuman,
      endISO:   timeRange.endHuman,
      sevenDaysAgoISO: new Date(sevenDaysAgo).toISOString(),
    },
    tokenInfo: {
      hasAccessToken:  !!user.googleFit.accessToken,
      hasRefreshToken: !!user.googleFit.refreshToken,
      tokenExpiry:     user.googleFit.tokenExpiry,
      isExpiredOrExpiring: isTokenExpiredOrExpiring(user.googleFit.tokenExpiry),
      usedFreshToken:  token !== user.googleFit.accessToken,
    },
    stepCounts: {
      strategy1_today: extractSteps(results.strategy1_typename_today.body),
      strategy2_today: extractSteps(results.strategy2_estimated_today.body),
      strategy3_7days: extractSteps(results.strategy3_typename_7days.body),
    },
    stepDataSources: (results.dataSources.body?.dataSource || [])
      .filter(ds => ds.dataType?.name?.includes("step"))
      .map(ds => ({ id: ds.dataStreamId, type: ds.dataType?.name })),
  };

  res.json({ success: true, summary, rawResults: results });
};

/** Sum all steps from a Google Fit aggregate response body */
function extractSteps(body) {
  if (!body || !body.bucket) return 0;
  let total = 0;
  for (const bucket of body.bucket) {
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        for (const val of point.value || []) {
          total += parseStepVal(val);
        }
      }
    }
  }
  return total;
}
