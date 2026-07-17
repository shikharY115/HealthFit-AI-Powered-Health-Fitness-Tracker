# HealthFit — AI-Powered Health & Fitness Tracker

![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Runtime-Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Backend-Express-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Styling-TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white)
![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-8E75B2?logo=googlegemini&logoColor=white)

A full-stack MERN web app that combines an AI nutrition assistant, natural-language meal logging, workout tracking, and Google Fit step syncing into a single health dashboard.

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

## About

HealthFit is an AI-powered health and fitness tracking web application. Users can log meals in plain natural language (e.g. *"3 chapatis, 1 bowl dal, 100g curd"*), chat with an AI assistant that both answers general fitness questions and automatically tracks nutrition from the conversation, log workouts, and sync — or manually enter — daily steps via Google Fit, all from one dashboard.

The nutrition engine pairs a curated Indian-food database with external food-data providers so common home-cooked meals are estimated accurately alongside packaged and international foods.

## Features

**🤖 AI Nutrition Assistant**
- Conversational chatbot (Google Gemini) that classifies each message as a meal to log or a general question
- Understands multi-item, natural-language meal descriptions in a single message
- Detected meals are auto-saved to your daily log, so the chatbot and the manual tracker always agree on calories

**🍽️ Meal & Calorie Tracking**
- Manual meal entry with calorie, protein, carb, and fat breakdown
- Built-in Indian food database (roti, dal, chapati, curd, etc.) for accurate regional estimates
- External food lookups for packaged/international foods, with response caching to avoid API rate limits

**🏋️ Workout Logging**
- Log exercises by name, sets, reps, and duration
- Calories burned calculated automatically via MET (Metabolic Equivalent of Task) values
- Card-based workout history

**👣 Step Tracking**
- Google Fit OAuth 2.0 integration for automatic step syncing
- Manual step entry as a fallback when Google Fit isn't connected

**📊 Dashboard**
- At-a-glance daily summary of meals, workouts, and steps

**🎨 UI/UX**
- Light/dark mode toggle, persisted in `localStorage`
- Glassmorphism-inspired design with the Inter typeface
- Toast notifications for success/error feedback
- Validated auth and tracking forms

**🔐 Auth & Stability**
- User registration and login
- Rate-limited AI and nutrition API routes to prevent abuse
- Standardized API error responses

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, React Router, Tailwind CSS, react-hot-toast |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| AI | Google Gemini API |
| Nutrition Data | Edamam Food Database API / Nutritionix API + local Indian-food dataset |
| Fitness Data | Google Fit API (OAuth 2.0) |

## Project Structure

```
HealthFit-AI-Powered-Health-Fitness-Tracker/
├── client/                     # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── AIChat.jsx
│   │   │   ├── Workout.jsx
│   │   │   └── Register.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   └── tailwind.config.js
├── server/                     # Express backend
│   ├── controllers/
│   │   ├── aiController.js
│   │   └── stepsController.js
│   ├── utils/
│   │   ├── aiAnalyzer.js       # Gemini meal/chat classification
│   │   └── nutritionApi.js     # Food-data API integration
│   ├── index.js                # Server entry point
│   └── .env                    # Environment variables (not committed)
└── .gitignore
```

## Getting Started

### Prerequisites

- Node.js v18+ and npm
- A MongoDB database (local instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)
- API keys: Google Gemini, a food-data provider (Edamam and/or Nutritionix), and Google Fit OAuth credentials

### Installation

```bash
git clone https://github.com/shikharY115/HealthFit-AI-Powered-Health-Fitness-Tracker.git
cd HealthFit-AI-Powered-Health-Fitness-Tracker

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### Environment Variables

Create a `.env` file inside `server/`:

```env
# Server
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

# AI
GEMINI_API_KEY=your_gemini_api_key

# Nutrition data (use whichever provider you've wired up)
EDAMAM_APP_ID=your_edamam_app_id
EDAMAM_APP_KEY=your_edamam_app_key
NUTRITIONIX_APP_ID=your_nutritionix_app_id
NUTRITIONIX_APP_KEY=your_nutritionix_app_key

# Google Fit
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

> Get a free Gemini key from [Google AI Studio](https://aistudio.google.com/), and food-data keys from [Edamam](https://developer.edamam.com/) or [Nutritionix](https://www.nutritionix.com/business/api). Without a valid Gemini key, AI chat falls back to a non-conversational mode.

### Running the App

```bash
# Terminal 1 — backend
cd server
npm run dev

# Terminal 2 — frontend
cd client
npm run dev   # or `npm start`, depending on your setup
```

Check your terminal output for the exact local ports (commonly `http://localhost:5173` for the client and `http://localhost:5000` for the server).

## Usage

1. **Register / log in** to create your profile.
2. **Log a meal** — type it into the AI Chat (e.g. *"I had 2 roti and a bowl of dal for lunch"*) or add it manually from the tracker.
3. **Log a workout** — enter the exercise, sets, reps, and duration; calories burned are calculated for you.
4. **Connect Google Fit** (optional) to sync steps automatically, or enter them manually.
5. **Check the Dashboard** for your daily summary.

## Roadmap

- [ ] Persist AI chat history per user in MongoDB
- [ ] Expand the Indian food database with more regional dishes
- [ ] Add weekly/monthly progress charts
- [ ] Add automated test coverage

## Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

No license has been specified for this project yet. If you'd like others to be able to use or contribute to this code, consider adding one (e.g. [MIT](https://choosealicense.com/licenses/mit/)).

## Author

**[@shikharY115](https://github.com/shikharY115)**
