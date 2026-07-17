/**
 * client/src/services/api.js
 * Centralized Axios instance for all API calls.
 * All requests go through Vite proxy → Express backend.
 * Credentials (cookies) are sent automatically.
 */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send httpOnly cookies on every request
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// --- Response interceptor: normalize errors ---
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Something went wrong'

    // If 401 and not on auth page, clear auth state (handled in AuthContext)
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }

    return Promise.reject({
      message,
      status: error.response?.status,
      needsReconnect: error.response?.data?.needsReconnect || false,
      data: error.response?.data,
    })
  }
)

// ===== Auth API =====
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
}

// ===== BMI API =====
export const bmiApi = {
  calculate: (data) => api.post('/bmi/calculate', data),
  getHistory: (limit = 20) => api.get(`/bmi/history?limit=${limit}`),
  deleteRecord: (id) => api.delete(`/bmi/${id}`),
}

// ===== Calorie / Meal API =====
export const calorieApi = {
  searchFood: (q) => api.get(`/calories/search-food?q=${encodeURIComponent(q)}`),
  addMeal: (data) => api.post('/calories/meal', data),
  getMeals: (date) => api.get(`/calories/meals${date ? `?date=${date}` : ''}`),
  updateMeal: (id, data) => api.put(`/calories/meal/${id}`, data),
  deleteMeal: (id) => api.delete(`/calories/meal/${id}`),
  getStats: () => api.get('/calories/stats'),
  getMacros: (date) => api.get(`/calories/macros${date ? `?date=${date}` : ''}`),
}

// ===== Workout API =====
export const workoutApi = {
  getLibrary: () => api.get('/workouts/library'),
  addWorkout: (data) => api.post('/workouts', data),
  getWorkouts: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/workouts${q ? `?${q}` : ''}`)
  },
  getWorkout: (id) => api.get(`/workouts/${id}`),
  deleteWorkout: (id) => api.delete(`/workouts/${id}`),
  getStats: () => api.get('/workouts/stats'),
  calculateCalories: (data) => api.post('/workouts/calculate-calories', data),
}

// ===== AI API =====
export const aiApi = {
  analyzeMeal: (data) => api.post('/ai/analyze-meal', data),
  chat: (message) => api.post('/ai/chat', { message }),
  getStatus: () => api.get('/ai/status'),
  getHistory: () => api.get('/ai/history'),
}

// ===== Steps API =====
export const stepsApi = {
  getGoogleAuthUrl:   () =>   api.get('/steps/google/auth'),
  disconnectGoogleFit:() =>   api.post('/steps/google/disconnect'),
  syncGoogleFit:      () =>   api.post('/steps/google/sync'),   // force fresh pull
  getTodaySteps:      () =>   api.get('/steps/today'),
  updateSteps:        (data)=> api.post('/steps/update', data),
  getHistory:         () =>   api.get('/steps/history'),
}

export default api
