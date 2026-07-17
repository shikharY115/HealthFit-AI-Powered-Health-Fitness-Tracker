/**
 * components/Layout.jsx
 * Main app layout with persistent sidebar, topbar, and page outlet.
 * Supports full light/dark theme switching with localStorage persistence.
 */
import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  RiDashboardLine, RiScales3Line, RiRestaurantLine,
  RiRunLine, RiRobotLine, RiFootprintLine,
  RiMenuLine, RiCloseLine, RiLogoutBoxLine,
  RiHeartPulseLine, RiMoonLine, RiSunLine
} from 'react-icons/ri'

const navItems = [
  { to: '/dashboard', icon: RiDashboardLine,  label: 'Dashboard'       },
  { to: '/bmi',       icon: RiScales3Line,    label: 'BMI Calculator'  },
  { to: '/calories',  icon: RiRestaurantLine, label: 'Calorie Tracker' },
  { to: '/workouts',  icon: RiRunLine,        label: 'Workouts'        },
  { to: '/ai',        icon: RiRobotLine,      label: 'AI Meal Analyzer'},
  { to: '/steps',     icon: RiFootprintLine,  label: 'Step Tracker'    },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const toggleDark = () => setDarkMode(d => !d)

  return (
    <div className="min-h-screen mesh-bg flex">
      {/* ===== Mobile Overlay ===== */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===== Sidebar ===== */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-30 flex flex-col
          backdrop-blur-xl
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:flex
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-green flex-shrink-0">
            <RiHeartPulseLine className="text-white text-xl" />
          </div>
          <span className="text-lg font-bold gradient-text">HealthFit</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
          >
            <RiCloseLine size={22} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 space-y-1">
          <button
            onClick={handleLogout}
            className="nav-link w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <RiLogoutBoxLine size={20} />
            <span>Logout</span>
          </button>
          {/* User avatar */}
          <div className="flex items-center gap-3 px-4 py-3 mt-2 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex items-center gap-4 px-4 lg:px-8 py-3 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl transition-all"
          >
            <RiMenuLine size={22} />
          </button>
          <div className="flex-1" />

          {/* Header actions */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              id="theme-toggle"
              onClick={toggleDark}
              className="p-2 rounded-xl transition-all duration-200"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <RiSunLine size={22} className="text-yellow-400" />
              ) : (
                <RiMoonLine size={22} className="text-slate-600" />
              )}
            </button>

            {/* Calorie goal chip */}
            {user?.dailyCalorieGoal && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs">
                <RiHeartPulseLine className="text-primary-500" size={13} />
                <span className="text-primary-600 dark:text-primary-300 font-medium">
                  {user.dailyCalorieGoal.toLocaleString()} kcal goal
                </span>
              </div>
            )}

            {/* User avatar */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-slate-300 leading-tight">{user?.name?.split(' ')[0]}</p>
                <p className="text-xs text-slate-500 leading-tight capitalize">
                  {user?.goal?.replace('_', ' ') || 'Stay healthy'}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-sm font-bold text-white ring-2 ring-primary-500/30">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
