/**
 * pages/Workout.jsx
 * Workout session manager with exercise library, MET-based calorie calculation.
 */
import { useState, useEffect } from 'react'
import { workoutApi } from '../services/api'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import toast from 'react-hot-toast'
import {
  RiRunLine, RiAddLine, RiDeleteBinLine, RiFireLine,
  RiTimeLine, RiCloseLine, RiCheckLine
} from 'react-icons/ri'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const isDarkMode = () => document.documentElement.classList.contains('dark')

const INTENSITY_LABELS = { 1: 'Very Light', 2: 'Light', 3: 'Moderate', 4: 'Hard', 5: 'Maximum' }
const MOOD_OPTS = ['great', 'good', 'okay', 'tired', 'struggling']
const MOOD_ICONS = { great: '🔥', good: '💪', okay: '😐', tired: '😴', struggling: '😤' }

export default function Workout() {
  const [library, setLibrary] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [stats, setStats] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [isDark, setIsDark] = useState(isDarkMode)

  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(isDarkMode()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Form state
  const [session, setSession] = useState({
    sessionName: '', date: new Date().toISOString().split('T')[0],
    intensity: 3, mood: 'good', notes: ''
  })
  const [exercises, setExercises] = useState([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [libRes, workRes, statsRes] = await Promise.allSettled([
          workoutApi.getLibrary(),
          workoutApi.getWorkouts({ limit: 20 }),
          workoutApi.getStats(),
        ])
        const get = (r) => r.status === 'fulfilled' ? r.value : null
        setLibrary(get(libRes)?.data || [])
        setWorkouts(get(workRes)?.data || [])
        setStats(get(statsRes) || null)
      } catch (e) { console.error('Workout load error:', e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const allCategories = ['All', ...library.map(c => c.category)]

  const addExercise = (ex) => {
    setExercises(prev => [...prev, {
      ...ex, duration: 30, sets: 3, reps: 12, weight: 0, distance: 0,
      intensity: 'moderate', caloriesBurned: 0
    }])
  }

  const removeExercise = (idx) => setExercises(prev => prev.filter((_, i) => i !== idx))

  const updateExercise = (idx, field, val) => {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e))
  }

  const previewCalories = async (idx) => {
    const ex = exercises[idx]
    try {
      const res = await workoutApi.calculateCalories({
        exerciseType: ex.key || ex.name,
        durationMinutes: ex.duration,
        intensity: ex.intensity,
      })
      updateExercise(idx, 'caloriesBurned', res.data.caloriesBurned)
    } catch { }
  }

  const handleSave = async () => {
    if (!session.sessionName) return toast.error('Please enter a session name')
    if (exercises.length === 0) return toast.error('Add at least one exercise')
    setSaving(true)
    try {
      await workoutApi.addWorkout({ ...session, exercises })
      toast.success('Workout saved! 💪')
      setShowModal(false)
      setSession({ sessionName: '', date: new Date().toISOString().split('T')[0], intensity: 3, mood: 'good', notes: '' })
      setExercises([])
      const [workRes, statsRes] = await Promise.all([workoutApi.getWorkouts({ limit: 20 }), workoutApi.getStats()])
      setWorkouts(workRes.data || [])
      setStats(statsRes)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await workoutApi.deleteWorkout(id)
      toast.success('Workout deleted')
      const res = await workoutApi.getWorkouts({ limit: 20 })
      setWorkouts(res.data || [])
    } catch { toast.error('Failed to delete') }
  }

  const filteredLibrary = activeCategory === 'All'
    ? library.flatMap(c => c.exercises.map(e => ({ ...e, category: c.category, icon: c.icon })))
    : library.find(c => c.category === activeCategory)?.exercises.map(e => ({
        ...e, category: activeCategory,
        icon: library.find(c => c.category === activeCategory)?.icon
      })) || []

  const barData = stats ? {
    labels: stats.data?.map(d => new Date(d.date).toLocaleDateString('en', { weekday: 'short' })) || [],
    datasets: [{
      label: 'Calories Burned',
      data: stats.data?.map(d => d.totalCaloriesBurned) || [],
      backgroundColor: 'rgba(249,115,22,0.7)',
      borderRadius: 8, borderSkipped: false,
    }],
  } : null

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2"><RiRunLine className="text-orange-400" /> Workout Manager</h1>
          <p className="page-subtitle">Log sessions, track calories burned, view history</p>
        </div>
        <button id="open-workout-modal" onClick={() => setShowModal(true)} className="btn-primary">
          <RiAddLine /> Log Workout
        </button>
      </div>

      {/* Weekly stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Sessions This Week', val: stats.weekTotals?.sessions || 0, icon: '🏋️', color: 'text-orange-400' },
            { label: 'Total Duration', val: `${stats.weekTotals?.duration || 0} min`, icon: '⏱️', color: 'text-blue-400' },
            { label: 'Calories Burned', val: stats.weekTotals?.caloriesBurned || 0, icon: '🔥', color: 'text-red-400' },
          ].map(({ label, val, icon, color }) => (
            <div key={label} className="glass-card p-4 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <p className={`text-2xl font-bold ${color}`}>{val}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calorie burn chart */}
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2"><RiFireLine className="text-orange-400" /> Weekly Burn</h2>
          <div className="h-44">
            {barData ? (
              <Bar key={`workout-${isDark}`} data={barData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: isDark ? '#1e293b' : '#f0faf0',
                    titleColor: isDark ? '#e2e8f0' : '#1a2e1a',
                    bodyColor:  isDark ? '#94a3b8' : '#4a6a48',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(120,180,120,0.25)',
                    borderWidth: 1,
                  },
                },
                scales: {
                  x: { ticks: { color: isDark ? '#64748b' : '#5a7a58', font: { size: 11 } }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(100,155,100,0.10)' } },
                  y: { ticks: { color: isDark ? '#64748b' : '#5a7a58', font: { size: 11 } }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(100,155,100,0.10)' } },
                },
              }} />
            ) : <div className="h-full flex items-center justify-center text-slate-500 text-sm">Loading...</div>}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="glass-card p-6">
          <h2 className="font-semibold text-slate-200 mb-4">Exercise Types</h2>
          {stats?.categoryBreakdown && Object.keys(stats.categoryBreakdown).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 capitalize">{cat}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? '#334155' : 'rgba(140,185,135,0.25)' }}>
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(100, (count / Math.max(...Object.values(stats.categoryBreakdown))) * 100)}%` }} />
                    </div>
                    <span className="text-slate-300 font-medium w-4">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-500 text-sm">No workouts logged yet</p>}
        </div>
      </div>

      {/* Recent workouts */}
      <div className="glass-card p-6">
        <h2 className="font-semibold text-slate-200 mb-4">Recent Workouts</h2>
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
        ) : workouts.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">🏋️</div>
            <p className="text-slate-400 mb-4">No workouts logged yet. Start your fitness journey!</p>
            <button onClick={() => setShowModal(true)} className="btn-primary">+ Log First Workout</button>
          </div>
        ) : (
          <div className="space-y-3">
            {workouts.map(w => (
              <div key={w._id} className="flex items-start gap-4 p-4 rounded-xl border transition-all group" style={{ background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(200,230,195,0.2)', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(140,185,135,0.25)' }}>
                <div className="text-2xl mt-1">{MOOD_ICONS[w.mood] || '💪'}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-slate-200">{w.sessionName}</h3>
                    <span className="badge bg-orange-500/20 text-orange-400 text-xs">Intensity {w.intensity}/5</span>
                    <span className="badge bg-surface-700 text-slate-400 text-xs capitalize">{w.mood}</span>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1"><RiFireLine className="text-orange-400" />{w.totalCaloriesBurned} kcal</span>
                    <span className="flex items-center gap-1"><RiTimeLine className="text-blue-400" />{w.totalDuration} min</span>
                    <span>{w.exercises?.length || 0} exercises</span>
                    <span>{new Date(w.date).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(w._id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-1">
                  <RiDeleteBinLine size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Workout Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="glass-card w-full max-w-2xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-100">Log Workout Session</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300 p-1"><RiCloseLine size={22} /></button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Session Name *</label>
                  <input id="workout-name" type="text" value={session.sessionName}
                    onChange={e => setSession({ ...session, sessionName: e.target.value })}
                    placeholder="e.g. Morning Run" className="input-field" />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" value={session.date}
                    onChange={e => setSession({ ...session, date: e.target.value })}
                    className="input-field" max={new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Intensity (1-5): {INTENSITY_LABELS[session.intensity]}</label>
                  <input type="range" min={1} max={5} value={session.intensity}
                    onChange={e => setSession({ ...session, intensity: parseInt(e.target.value) })}
                    className="w-full accent-orange-500" />
                </div>
                <div>
                  <label className="form-label">Mood</label>
                  <div className="flex gap-2">
                    {MOOD_OPTS.map(m => (
                      <button key={m} type="button" onClick={() => setSession({ ...session, mood: m })}
                        title={m} className={`flex-1 py-2 rounded-lg text-sm border transition-all ${
                          session.mood === m
                            ? 'border-orange-500 bg-orange-500/20'
                            : isDark ? 'border-white/10 bg-surface-800 hover:border-white/20' : 'border-green-200 bg-green-50/80 hover:border-orange-400/40'
                        }`}>{MOOD_ICONS[m]}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Exercise library */}
              <div>
                <label className="form-label">Add Exercises</label>
                <div className="flex gap-2 flex-wrap mb-3">
                  {allCategories.map(cat => (
                    <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        activeCategory === cat
                          ? 'border-primary-500 bg-primary-500/20 text-primary-600 dark:text-primary-400'
                          : isDark ? 'border-white/10 bg-surface-800 text-slate-400 hover:border-white/20' : 'border-green-200/70 bg-green-50/80 text-slate-600 hover:border-primary-400/40'
                      }`}>{cat}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {filteredLibrary.map((ex, i) => (
                    <button key={i} type="button" onClick={() => addExercise(ex)}
                      className="text-left px-3 py-2.5 rounded-xl border hover:border-primary-500/50 hover:bg-primary-500/5 transition-all text-sm"
                      style={{ background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(240,250,240,0.8)', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(140,185,135,0.28)' }}>
                      <div className="flex items-center gap-2">
                        <span>{ex.icon || '🏋️'}</span>
                        <span className="text-slate-300 truncate">{ex.name}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 ml-6">MET: {ex.metValue}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Added exercises */}
              {exercises.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Added exercises ({exercises.length}) — Set duration to calculate calories</p>
                  {exercises.map((ex, idx) => (
                    <div key={idx} className="rounded-xl p-3 border" style={{ background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(240,250,240,0.7)', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(140,185,135,0.25)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-200">{ex.icon} {ex.name}</span>
                        <div className="flex items-center gap-2">
                          {ex.caloriesBurned > 0 && <span className="text-xs text-orange-400 font-semibold">{ex.caloriesBurned} kcal</span>}
                          <button onClick={() => removeExercise(idx)} className="text-slate-500 hover:text-red-400"><RiCloseLine size={14} /></button>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-2">
                        {ex.category?.toLowerCase().includes('cardio') || ex.category?.toLowerCase().includes('sports') || ex.category?.toLowerCase().includes('yoga') ? (
                          <div className="flex-1">
                            <p className="text-xs text-slate-600 mb-1">Duration (Min)</p>
                            <input type="number" value={ex.duration} min={1}
                              onChange={e => { updateExercise(idx, 'duration', parseFloat(e.target.value) || 0); previewCalories(idx); }}
                              className="input-field text-sm py-2 px-3" placeholder="Minutes" />
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <p className="text-xs text-slate-600 mb-1">Sets</p>
                              <input type="number" value={ex.sets} min={1}
                                onChange={e => {
                                  updateExercise(idx, 'sets', parseFloat(e.target.value) || 0);
                                  // Auto-estimate duration based on sets (approx 3 mins per set including rest)
                                  updateExercise(idx, 'duration', (parseFloat(e.target.value) || 0) * 3);
                                  previewCalories(idx);
                                }}
                                className="input-field text-sm py-2 px-3" placeholder="Sets" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-slate-600 mb-1">Reps</p>
                              <input type="number" value={ex.reps} min={1}
                                onChange={e => updateExercise(idx, 'reps', parseFloat(e.target.value) || 0)}
                                className="input-field text-sm py-2 px-3" placeholder="Reps" />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="text-right text-sm font-semibold text-orange-400">
                    Total: ~{exercises.reduce((s, e) => s + (e.caloriesBurned || 0), 0)} kcal burned
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button id="save-workout" onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : <><RiCheckLine /> Save Session</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
