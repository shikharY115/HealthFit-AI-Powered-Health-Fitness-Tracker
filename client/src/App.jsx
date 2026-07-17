/**
 * App.jsx - Root component with routing and lazy-loaded pages.
 * Pages are code-split so only the current page's JS is loaded immediately.
 * DashboardProvider wraps authenticated routes so the cache persists across navigation.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DashboardProvider } from './context/DashboardContext'
import Layout from './components/Layout'

// Lazy-load all pages — each becomes a separate JS chunk
const Login         = lazy(() => import('./pages/Login'))
const Register      = lazy(() => import('./pages/Register'))
const Dashboard     = lazy(() => import('./pages/Dashboard'))
const BMI           = lazy(() => import('./pages/BMI'))
const CalorieTracker = lazy(() => import('./pages/CalorieTracker'))
const Workout       = lazy(() => import('./pages/Workout'))
const AIChat        = lazy(() => import('./pages/AIChat'))
const StepTracker   = lazy(() => import('./pages/StepTracker'))

// Lightweight fallback shown while a lazy chunk loads
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-[40vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      <p className="text-xs text-slate-500 animate-pulse">Loading...</p>
    </div>
  </div>
)

// Protected route: redirects to login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-slate-400 animate-pulse">Loading HealthFit...</p>
      </div>
    </div>
  )
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// Public route: redirects to dashboard if already authenticated
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login"    element={<PublicRoute><Suspense fallback={null}><Login /></Suspense></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Suspense fallback={null}><Register /></Suspense></PublicRoute>} />

      {/* All authenticated pages share Layout + DashboardProvider (cache persists across nav) */}
      <Route element={
        <ProtectedRoute>
          <DashboardProvider>
            <Layout />
          </DashboardProvider>
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
        <Route path="/bmi"       element={<Suspense fallback={<PageLoader />}><BMI /></Suspense>} />
        <Route path="/calories"  element={<Suspense fallback={<PageLoader />}><CalorieTracker /></Suspense>} />
        <Route path="/workouts"  element={<Suspense fallback={<PageLoader />}><Workout /></Suspense>} />
        <Route path="/ai"        element={<Suspense fallback={<PageLoader />}><AIChat /></Suspense>} />
        <Route path="/steps"     element={<Suspense fallback={<PageLoader />}><StepTracker /></Suspense>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
