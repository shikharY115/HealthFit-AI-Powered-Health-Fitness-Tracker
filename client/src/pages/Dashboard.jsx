/**
 * pages/Dashboard.jsx
 * Reads from DashboardContext (cached) — no direct API calls here.
 * First visit triggers a fetch; subsequent visits return instantly from cache
 * and silently revalidate in the background after 60 s.
 */
import { useEffect, useMemo, memo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../context/DashboardContext'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { useState } from 'react'
import {
  RiHeartPulseLine, RiFireLine, RiRunLine, RiFootprintLine,
  RiScales3Line, RiRestaurantLine, RiRobotLine
} from 'react-icons/ri'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

/** Returns chart theme tokens based on current html.dark class */
function getChartTheme(isDark) {
  return {
    isDark,
    tickColor:    isDark ? '#64748b' : '#5a7a58',
    gridColor:    isDark ? 'rgba(255,255,255,0.04)' : 'rgba(100,155,100,0.10)',
    legendColor:  isDark ? '#94a3b8' : '#4a6a48',
    tooltipBg:    isDark ? '#1e293b' : '#f0faf0',
    tooltipTitle: isDark ? '#e2e8f0' : '#1a2e1a',
    tooltipBody:  isDark ? '#94a3b8' : '#4a6a48',
    tooltipBorder:isDark ? 'rgba(255,255,255,0.08)' : 'rgba(120,180,120,0.25)',
  }
}

// ── Skeleton loader ──────────────────────────────────────────────────────────
const DashboardSkeleton = memo(() => (
  <div className="space-y-6">
    <div className="skeleton h-24 w-full" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28" />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-64" />)}
    </div>
  </div>
))

export default function Dashboard() {
  const { user } = useAuth()
  const { data, loading, loaded, fetchDashboard } = useDashboard()

  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  )

  // Theme observer
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    )
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Trigger fetch (uses cache if fresh; background-revalidates if stale)
  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  // ── Derived values (memoised to avoid work on re-renders) ────────────────
  const todayLabel = useMemo(() =>
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  , [])

  const calPercent  = Math.min(100, Math.round((data.todayCalories / (data.dailyGoal || 2000)) * 100))
  const stepPercent = Math.min(100, Math.round((data.todaySteps    / (data.stepGoal  || 10000)) * 100))

  const ct = useMemo(() => getChartTheme(isDark), [isDark])

  const chartDefaults = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { labels: { color: ct.legendColor, font: { family: 'Inter', size: 11 } } },
      tooltip: {
        backgroundColor: ct.tooltipBg,
        titleColor: ct.tooltipTitle,
        bodyColor:  ct.tooltipBody,
        borderColor: ct.tooltipBorder,
        borderWidth: 1, padding: 12, cornerRadius: 10,
      },
    },
    scales: {
      x: { ticks: { color: ct.tickColor, font: { size: 11 } }, grid: { color: ct.gridColor } },
      y: { ticks: { color: ct.tickColor, font: { size: 11 } }, grid: { color: ct.gridColor } },
    },
  }), [ct])

  const days = useMemo(
    () => data.calorieStats.map(d => new Date(d.date).toLocaleDateString('en', { weekday: 'short' })),
    [data.calorieStats]
  )

  const calorieLineData = useMemo(() => ({
    labels: days,
    datasets: [{
      label: 'Calories',
      data: data.calorieStats.map(d => d.calories),
      borderColor: '#22c55e',
      backgroundColor: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.10)',
      fill: true, tension: 0.4,
      pointBackgroundColor: '#22c55e',
      pointRadius: 4, pointHoverRadius: 6,
    }],
  }), [days, data.calorieStats, isDark])

  const burnBarData = useMemo(() => ({
    labels: days,
    datasets: [{
      label: 'Calories Burned',
      data: data.workoutStats.map(d => d.totalCaloriesBurned),
      backgroundColor: isDark ? 'rgba(249,115,22,0.7)' : 'rgba(234,88,12,0.65)',
      borderRadius: 8, borderSkipped: false,
    }],
  }), [days, data.workoutStats, isDark])

  const macroDonutData = useMemo(() =>
    data.macros && (data.macros.protein || data.macros.carbs || data.macros.fat)
      ? {
          labels: ['Protein', 'Carbs', 'Fat'],
          datasets: [{
            data: [data.macros.protein || 0, data.macros.carbs || 0, data.macros.fat || 0],
            backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(34,197,94,0.8)', 'rgba(249,115,22,0.8)'],
            borderColor: ['#3b82f6', '#22c55e', '#f97316'],
            borderWidth: 2,
          }],
        }
      : null,
    [data.macros]
  )

  // Show skeleton only on very first load (not on background revalidation)
  if (loading && !loaded) return <DashboardSkeleton />

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">
            Good {greeting}, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="page-subtitle">{todayLabel}</p>
        </div>
        <Link to="/ai" className="btn-primary hidden sm:flex gap-2 items-center">
          <RiRobotLine /> AI Analyzer
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Calories consumed */}
        <div className="stat-card group">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform">
              <RiRestaurantLine size={20} />
            </div>
            <span className={`badge ${calPercent >= 100 ? 'bg-red-500/20 text-red-500' : 'bg-primary-500/15 text-primary-600 dark:text-primary-400'}`}>
              {calPercent}%
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{data.todayCalories.toLocaleString()}</p>
            <p className="text-xs text-slate-500">of {data.dailyGoal.toLocaleString()} kcal goal</p>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill bg-gradient-to-r from-primary-600 to-primary-400" style={{ width: `${calPercent}%` }} />
          </div>
          <p className="text-xs text-slate-500">Calories Consumed</p>
        </div>

        {/* Calories burned */}
        <div className="stat-card group">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
              <RiFireLine size={20} />
            </div>
            {data.todayBurned > 0 && <span className="badge bg-orange-500/15 text-orange-600 dark:text-orange-400">Active!</span>}
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{data.todayBurned.toLocaleString()}</p>
            <p className="text-xs text-slate-500">kcal burned today</p>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill bg-gradient-to-r from-orange-600 to-orange-400"
              style={{ width: `${Math.min(100, (data.todayBurned / 600) * 100)}%` }} />
          </div>
          <p className="text-xs text-slate-500">Calories Burned</p>
        </div>

        {/* Steps */}
        <div className="stat-card group">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
              <RiFootprintLine size={20} />
            </div>
            <span className={`badge ${stepPercent >= 100 ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'}`}>
              {stepPercent}%
            </span>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{data.todaySteps.toLocaleString()}</p>
            <p className="text-xs text-slate-500">of {data.stepGoal.toLocaleString()} steps goal</p>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill bg-gradient-to-r from-blue-600 to-blue-400" style={{ width: `${stepPercent}%` }} />
          </div>
          <p className="text-xs text-slate-500">Steps Today</p>
        </div>

        {/* BMI */}
        <div className="stat-card group">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
              <RiScales3Line size={20} />
            </div>
            {data.latestBMI && (
              <span className="badge text-xs" style={{
                backgroundColor: `${data.latestBMI.bmi < 18.5 ? '#60a5fa' : data.latestBMI.bmi < 25 ? '#4ade80' : data.latestBMI.bmi < 30 ? '#facc15' : '#f87171'}20`,
                color: data.latestBMI.bmi < 18.5 ? '#60a5fa' : data.latestBMI.bmi < 25 ? '#16a34a' : data.latestBMI.bmi < 30 ? '#a16207' : '#ef4444',
              }}>{data.latestBMI.category}</span>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{data.latestBMI?.bmi || '—'}</p>
            <p className="text-xs text-slate-500">{data.latestBMI ? `${data.latestBMI.weight}kg, ${data.latestBMI.height}cm` : 'Not calculated yet'}</p>
          </div>
          <Link to="/bmi" className="text-xs text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 mt-1 font-medium">
            {data.latestBMI ? 'Recalculate →' : 'Calculate now →'}
          </Link>
          <p className="text-xs text-slate-500">BMI Score</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calorie trend */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <RiRestaurantLine className="text-primary-500" /> Weekly Calorie Intake
          </h3>
          <div className="h-48">
            {data.calorieStats.length > 0 ? (
              <Line key={`line-${isDark}`} data={calorieLineData} options={chartDefaults} />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No meal data yet. <Link to="/calories" className="text-primary-500 ml-1">Log your first meal →</Link>
              </div>
            )}
          </div>
        </div>

        {/* Macro breakdown */}
        <div className="glass-card p-6">
          <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <RiHeartPulseLine className="text-accent-blue" /> Today's Macros
          </h3>
          <div className="h-40">
            {macroDonutData ? (
              <Doughnut key={`donut-${isDark}`} data={macroDonutData} options={{
                ...chartDefaults,
                scales: undefined,
                cutout: '65%',
                plugins: {
                  ...chartDefaults.plugins,
                  legend: { position: 'bottom', labels: { color: ct.legendColor, font: { size: 10 }, padding: 10 } }
                }
              }} />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm text-center">
                Log meals to see<br />macro breakdown
              </div>
            )}
          </div>
          {data.macros && (
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[
                { label: 'Protein', val: data.macros.protein, color: 'text-blue-500 dark:text-blue-400' },
                { label: 'Carbs',   val: data.macros.carbs,   color: 'text-primary-600 dark:text-primary-400' },
                { label: 'Fat',     val: data.macros.fat,     color: 'text-orange-500 dark:text-orange-400' },
              ].map(({ label, val, color }) => (
                <div key={label}>
                  <p className={`text-sm font-semibold ${color}`}>{val}g</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workout Calories Bar Chart */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <RiFireLine className="text-orange-500" /> Weekly Calories Burned
        </h3>
        <div className="h-44">
          {data.workoutStats.some(d => d.totalCaloriesBurned > 0) ? (
            <Bar key={`bar-${isDark}`} data={burnBarData} options={chartDefaults} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              No workouts logged yet. <Link to="/workouts" className="text-primary-500 ml-1">Add your first workout →</Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="font-semibold text-slate-300 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { to: '/calories', icon: '🍽️', label: 'Log Meal',    lightBg: 'rgba(34,197,94,0.08)',   darkCls: 'from-primary-900/50 to-primary-800/30' },
            { to: '/workouts', icon: '💪', label: 'Log Workout', lightBg: 'rgba(249,115,22,0.08)',  darkCls: 'from-orange-900/50 to-orange-800/30'   },
            { to: '/bmi',      icon: '⚖️', label: 'Check BMI',   lightBg: 'rgba(168,85,247,0.08)', darkCls: 'from-purple-900/50 to-purple-800/30'   },
            { to: '/ai',       icon: '🤖', label: 'AI Analyze',  lightBg: 'rgba(6,182,212,0.08)',  darkCls: 'from-cyan-900/50 to-cyan-800/30'       },
            { to: '/steps',    icon: '👟', label: 'Log Steps',   lightBg: 'rgba(59,130,246,0.08)', darkCls: 'from-blue-900/50 to-blue-800/30'       },
          ].map(({ to, icon, label, lightBg, darkCls }) => (
            <Link key={to} to={to}
              className={`glass-card p-4 text-center hover:scale-105 transition-transform dark:bg-gradient-to-br dark:${darkCls}`}
              style={!isDark ? { background: lightBg } : undefined}
            >
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-xs font-medium text-slate-300">{label}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
