# Health Platform Upgrade Implementation Plan

This plan outlines the systematic improvements required to upgrade the existing application into a production-quality, intelligent health platform.

## User Review Required

> [!IMPORTANT]
> The transition from USDA API to Nutritionix API requires new credentials. You will need to sign up for a free Nutritionix API account (if you haven't already) and add the following keys to your `server/.env` file:
> ```env
> NUTRITIONIX_APP_ID=your_app_id
> NUTRITIONIX_APP_KEY=your_app_key
> ```
> Please confirm if you are okay with this transition and will be able to provide the keys, or if you want me to stick to the mock database for now.

## Open Questions

1. **Dark Mode:** Do you want the dark mode toggle to be placed in the main navigation bar, or inside a user settings dropdown?
2. **AI Chatbot Storage:** Should the Chatbot history be persisted in the MongoDB database so users can see past conversations, or is it okay if it clears on page reload?

## Proposed Changes

### Backend - Integrations & AI

#### [MODIFY] `server/utils/nutritionApi.js`
- **Nutritionix Integration:** Replace the USDA FoodData Central logic with the Nutritionix Natural Language endpoint (`/v2/natural/nutrients`). This is significantly better for parsing natural language queries like "1 bowl dal and 3 roti".
- **Caching:** Implement a simple in-memory cache to store API responses and prevent "Too Many Requests" errors and reduce API calls.
- **Mock DB Update:** Enhance the fallback mock database to have more accurate and comprehensive Indian food entries.

#### [MODIFY] `server/utils/aiAnalyzer.js`
- **Dual Mode AI:** Overhaul the Gemini prompt to dynamically classify user input as either a `meal_analysis` or `general_chat`.
- **Accurate Calories:** If classified as a meal, the AI will extract the items and use the Nutritionix API to calculate the exact calories, guaranteeing that the Chatbot and manual tracker return identical results.
- **Conversational Awareness:** Update the function signature to accept chat history for contextual awareness.

#### [MODIFY] `server/controllers/aiController.js`
- **Unified Chat Endpoint:** Refactor the chat endpoint to seamlessly handle both meal tracking (with auto-saving to DB) and general Q&A using the new dual-mode analyzer.

### Backend - Stability

#### [MODIFY] `server/index.js`
- Ensure `express-rate-limit` is properly configured for the AI and Nutrition routes specifically to prevent abuse.
- Standardize error formatting.

#### [MODIFY] `server/controllers/stepsController.js`
- Review and patch the Google Fit OAuth 2.0 flow. Ensure token refresh logic is robust and the fallback to manual entry works gracefully when the API fails.

### Frontend - UI/UX & Features

#### [MODIFY] `client/tailwind.config.js` & `client/src/index.css`
- **Dark Mode:** Fix the Tailwind dark mode implementation (`darkMode: 'class'`) and ensure correct color variables are applied to `body`.
- **Aesthetics:** Refine color palettes, add glassmorphism utilities, and ensure consistent typography (Inter font).

#### [MODIFY] `client/src/App.jsx` (and/or Navigation Components)
- Implement a Dark Mode Toggle switch.
- Persist the chosen theme to `localStorage`.

#### [MODIFY] `client/src/pages/AIChat.jsx`
- **Real Chat Interface:** Transform this page into a true chat interface (similar to ChatGPT).
- Implement message bubbles, auto-scrolling, loading indicators (typing skeletons), and handle the dual-mode responses (rendering meal cards within the chat).

#### [MODIFY] `client/src/pages/Workout.jsx`
- **Simplify UI:** Remove cluttered fields. The form will only ask for: Exercise Name, Sets, Reps, Duration, and Calories Burned (calculated via MET).
- Improve spacing and use clean cards for the workout history.

#### [MODIFY] `client/src/pages/Dashboard.jsx` & `client/src/pages/Register.jsx`
- Clean up the layouts using the refined CSS components.
- Add `react-hot-toast` for success/error notifications.
- Ensure all forms have strong validation.

## Verification Plan

### Automated Tests
- Test the Nutritionix API implementation manually using the browser tool.

### Manual Verification
- **Calorie Consistency:** Input "2 roti and 1 cup dal" in the AI Chatbot and the Manual Tracker and verify the calories match.
- **Chatbot Flow:** Ask the chatbot "What is React?" (verify general response) and then "I ate an apple" (verify fitness response + tracking).
- **Dark Mode:** Toggle dark mode and refresh the page to ensure persistence.
- **Google Fit:** Verify the Google OAuth flow logic and manual step entry fallback.
