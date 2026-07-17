/**
 * pages/CalorieTracker.jsx
 * Daily meal logging with Edamam food search, macros tracking, and weekly stats.
 */
import { useState, useEffect, useCallback } from 'react'
import { calorieApi } from '../services/api'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import toast from 'react-hot-toast'
import {
  RiRestaurantLine, RiAddLine, RiDeleteBinLine, RiEditLine,
  RiSearchLine, RiCloseLine, RiCheckLine, RiCalendarLine
} from 'react-icons/ri'

ChartJS.register(ArcElement, Tooltip, Legend)

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout']
const MEAL_ICONS = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍿', pre_workout: '⚡', post_workout: '🏋️' }

// Grams per unit — used for calorie recalculation when unit or qty changes
const UNIT_TO_GRAMS = { g: 1, piece: 40, bowl: 200, cup: 240, serving: 100 }

// Derive per-100g nutrients from an API food object.
// IMPORTANT: The API now ALWAYS returns servingSizeUnit='g' and servingSize as actual grams.
// So totalGrams = servingSize (no unit conversion needed).
const computePer100g = (food) => {
  const totalGrams = food.servingSize || 100 // already in grams
  if (totalGrams <= 0) return { cal: food.calories, prot: food.protein || 0, carb: food.carbs || 0, fat: food.fat || 0 }
  return {
    cal:  (food.calories        / totalGrams) * 100,
    prot: ((food.protein || 0) / totalGrams) * 100,
    carb: ((food.carbs   || 0) / totalGrams) * 100,
    fat:  ((food.fat     || 0) / totalGrams) * 100,
  }
}

// Recalculate macros from baseline when qty or unit changes
const recalcNutrition = (per100g, qty, unit) => {
  const grams = qty * (UNIT_TO_GRAMS[unit] ?? 1)
  return {
    calories: Math.round(per100g.cal  * grams / 100),
    protein:  Math.round(per100g.prot * grams / 100 * 10) / 10,
    carbs:    Math.round(per100g.carb * grams / 100 * 10) / 10,
    fat:      Math.round(per100g.fat  * grams / 100 * 10) / 10,
  }
}

export default function CalorieTracker() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [meals, setMeals] = useState([])
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [dailyGoal, setDailyGoal] = useState(2000)
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(true)

  // Add meal form state
  const [form, setForm] = useState({ mealType: 'breakfast', mealName: '', notes: '' })
  const [foods, setFoods] = useState([]) // Foods being added
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadMeals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await calorieApi.getMeals(date)
      setMeals(res.data || [])
      setTotals(res.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 })
      setDailyGoal(res.dailyGoal || 2000)
    } catch { }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { loadMeals() }, [loadMeals])

  // Debounced food search
  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await calorieApi.searchFood(searchQ)
        setSearchResults(res.data?.slice(0, 6) || [])
      } catch { } finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [searchQ])

  const addFoodItem = (food) => {
    // API always returns servingSizeUnit='g', so totalGrams = servingSize
    const per100g = computePer100g(food)
    // Default display unit: grams (since API always gives grams)
    // initQty = servingSize so user sees the original serving amount in grams
    const initQty  = food.servingSize || 100
    const initUnit = 'g'
    setFoods(prev => [...prev, {
      ...food,
      ...recalcNutrition(per100g, initQty, initUnit),
      per100g,
      qty:  initQty,
      unit: initUnit,
    }])
    setSearchQ('')
    setSearchResults([])
  }

  const removeFoodItem = (idx) => setFoods(prev => prev.filter((_, i) => i !== idx))

  const handleSaveMeal = async () => {
    if (!form.mealName) return toast.error('Please enter a meal name')
    if (foods.length === 0) return toast.error('Please add at least one food item')
    setSaving(true)
    try {
      // Map to backend schema — strip client-only fields (per100g, qty, unit)
      const foodsToSave = foods.map(f => ({
        name:     f.name,
        quantity: `${f.qty} ${f.unit}`,
        calories: f.calories,
        protein:  f.protein  || 0,
        carbs:    f.carbs    || 0,
        fat:      f.fat      || 0,
        fiber:    f.fiber    || 0,
        sugar:    f.sugar    || 0,
        sodium:   f.sodium   || 0,
        fdcId:    f.fdcId    || null,
        source:   f.source   || 'manual',
      }))
      await calorieApi.addMeal({ ...form, date, foods: foodsToSave })
      toast.success('Meal logged! 🍽️')
      setShowAddModal(false)
      setForm({ mealType: 'breakfast', mealName: '', notes: '' })
      setFoods([])
      await loadMeals()
    } catch (err) {
      toast.error(err.message)
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await calorieApi.deleteMeal(id)
      toast.success('Meal deleted')
      await loadMeals()
    } catch { toast.error('Failed to delete') }
  }

  const calPercent = Math.min(100, Math.round((totals.calories / dailyGoal) * 100))
  const totalMacroG = (totals.protein || 0) + (totals.carbs || 0) + (totals.fat || 0)
  const donutData = totalMacroG > 0 ? {
    labels: ['Protein', 'Carbs', 'Fat'],
    datasets: [{
      data: [totals.protein || 0, totals.carbs || 0, totals.fat || 0],
      backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(34,197,94,0.8)', 'rgba(249,115,22,0.8)'],
      borderColor: ['#3b82f6', '#22c55e', '#f97316'], borderWidth: 2,
    }],
  } : null

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title flex items-center gap-2"><RiRestaurantLine className="text-primary-400" /> Calorie Tracker</h1>
          <p className="page-subtitle">Track your daily nutrition and macros</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date picker */}
          <div className="relative">
            <RiCalendarLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="input-field pl-9 pr-4 py-2 w-40 text-sm" max={new Date().toISOString().split('T')[0]} />
          </div>
          <button id="open-add-meal" onClick={() => setShowAddModal(true)} className="btn-primary gap-2">
            <RiAddLine /> Log Meal
          </button>
        </div>
      </div>

      {/* Daily summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calorie progress */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Daily Calories</h2>
            <span className={`badge ${calPercent >= 100 ? 'bg-red-500/20 text-red-400' : 'bg-primary-500/20 text-primary-400'}`}>
              {totals.calories} / {dailyGoal} kcal
            </span>
          </div>
          <div className="relative h-4 rounded-full overflow-hidden mb-4" style={{ background: document.documentElement.classList.contains('dark') ? '#334155' : 'rgba(140,185,135,0.22)' }}>
            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${calPercent >= 100 ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-primary-600 to-primary-400'}`}
              style={{ width: `${calPercent}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Consumed', val: totals.calories, unit: 'kcal', color: 'text-slate-100' },
              { label: 'Protein',  val: totals.protein,  unit: 'g',    color: 'text-blue-400'    },
              { label: 'Carbs',    val: totals.carbs,    unit: 'g',    color: 'text-primary-400' },
              { label: 'Fat',      val: totals.fat,      unit: 'g',    color: 'text-orange-400'  },
            ].map(({ label, val, unit, color }) => (
              <div key={label} className="text-center">
                <p className={`text-xl font-bold ${color}`}>{val || 0} <span className="text-sm font-normal">{unit}</span></p>
                <p className="text-xs text-slate-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Macro donut */}
        <div className="glass-card p-6 flex flex-col items-center">
          <h2 className="font-semibold text-slate-200 mb-3 self-start">Macros</h2>
          <div className="w-36 h-36">
            {donutData ? (
              <Doughnut data={donutData} options={{
                cutout: '65%', maintainAspectRatio: false, responsive: true,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#e2e8f0', bodyColor: '#94a3b8' } }
              }} />
            ) : (
              <div className="w-full h-full rounded-full border-4 border-dashed border-surface-700 flex items-center justify-center text-slate-600 text-xs text-center">
                No meals<br />logged
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 w-full text-center">
            {[
              { label: 'P', val: totals.protein, color: 'text-blue-400', bg: 'bg-blue-500' },
              { label: 'C', val: totals.carbs, color: 'text-primary-400', bg: 'bg-primary-500' },
              { label: 'F', val: totals.fat, color: 'text-orange-400', bg: 'bg-orange-500' },
            ].map(({ label, val, color, bg }) => (
              <div key={label}>
                <div className={`w-2 h-2 rounded-full ${bg} mx-auto mb-1`} />
                <p className={`text-sm font-semibold ${color}`}>{val || 0}g</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Meals list */}
      <div className="glass-card p-6">
        <h2 className="font-semibold text-slate-200 mb-4">
          {loading ? 'Loading...' : meals.length === 0 ? 'No meals logged for this day' : `${meals.length} meal${meals.length > 1 ? 's' : ''} logged`}
        </h2>
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
        ) : meals.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🍽️</div>
            <p className="text-slate-400 mb-4">Start logging your meals to track calories</p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary">+ Log First Meal</button>
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map(meal => (
              <div key={meal._id} className="flex items-start gap-4 p-4 rounded-xl border transition-all group"
                style={{
                  background: document.documentElement.classList.contains('dark') ? 'rgba(15,23,42,0.5)' : 'rgba(200,232,195,0.22)',
                  borderColor: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(140,185,135,0.28)',
                }}>
                <div className="text-2xl mt-1">{MEAL_ICONS[meal.mealType] || '🍴'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-slate-200">{meal.mealName}</h3>
                    <span className="badge text-xs capitalize" style={{ background: 'rgba(100,140,100,0.15)', color: document.documentElement.classList.contains('dark') ? '#94a3b8' : '#4a6a48' }}>{meal.mealType.replace('_', ' ')}</span>
                    {meal.aiNote && <span className="badge bg-cyan-500/20 text-cyan-500 text-xs">🤖 AI</span>}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                    <span className="text-primary-400 font-semibold">{meal.totalCalories} kcal</span>
                    <span>P: {meal.totalProtein}g</span>
                    <span>C: {meal.totalCarbs}g</span>
                    <span>F: {meal.totalFat}g</span>
                    <span>{meal.foods?.length || 0} items</span>
                  </div>
                  {meal.aiSuggestions?.length > 0 && (
                    <p className="text-xs text-cyan-400/70 mt-1">{meal.aiSuggestions[0]}</p>
                  )}
                </div>
                <button onClick={() => handleDelete(meal._id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-1 mt-1">
                  <RiDeleteBinLine size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Meal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="glass-card w-full max-w-lg p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-100">Log a Meal</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-300 p-1"><RiCloseLine size={22} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Meal Type</label>
                  <select id="meal-type" value={form.mealType} onChange={e => setForm({ ...form, mealType: e.target.value })} className="select-field">
                    {MEAL_TYPES.map(t => <option key={t} value={t}>{MEAL_ICONS[t]} {t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Meal Name *</label>
                  <input id="meal-name" type="text" value={form.mealName}
                    onChange={e => setForm({ ...form, mealName: e.target.value })}
                    placeholder="e.g. Chicken & Rice" className="input-field" />
                </div>
              </div>

              {/* Food search */}
              <div>
                <label className="form-label">Search Foods (Edamam Database)</label>
                <div className="relative">
                  <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input id="food-search" type="text" value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Search chicken, dal, rice..." className="input-field pl-11" />
                  {searching && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />}
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 rounded-xl border overflow-hidden divide-y"
                    style={{
                      background: document.documentElement.classList.contains('dark') ? '#0f172a' : 'rgba(248,252,246,0.97)',
                      borderColor: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.10)' : 'rgba(140,185,135,0.32)',
                      divideColor: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(140,185,135,0.15)',
                    }}>
                    {searchResults.map((food, i) => (
                      <button key={i} onClick={() => addFoodItem(food)}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-200 font-medium">{food.name}</p>
                            <p className="text-xs text-slate-500">
                              {food.servingSize}g per 100g ·
                              {food.source === 'indian_db'
                                ? ' 🇮🇳 Indian DB'
                                : food.source === 'edamam'
                                ? ' 🌐 Edamam'
                                : ' 📊 DB'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary-400">{food.calories} kcal</p>
                            <p className="text-xs text-slate-500">P:{food.protein}g C:{food.carbs}g F:{food.fat}g</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {/* Food not found — shown only when search finished and returned nothing */}
                {!searching && searchQ.length >= 2 && searchResults.length === 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2">
                    <span className="text-yellow-400 text-base mt-0.5">⚠️</span>
                    <div>
                      <p className="text-xs text-yellow-400 font-semibold">No results for &ldquo;{searchQ}&rdquo;</p>
                      <p className="text-xs text-slate-500 mt-0.5">Try a simpler term — e.g. &ldquo;milk&rdquo;, &ldquo;chicken&rdquo;, &ldquo;rice&rdquo;, &ldquo;egg&rdquo;.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Added foods list */}
              {foods.length > 0 && (
                <div className="rounded-xl p-3 space-y-3 border"
                style={{
                  background: document.documentElement.classList.contains('dark') ? 'rgba(15,23,42,0.5)' : 'rgba(230,248,228,0.5)',
                  borderColor: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(140,185,135,0.25)',
                }}>
                  <p className="text-xs text-slate-500 mb-1">Added foods ({foods.length})</p>
                  {foods.map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm p-2 rounded-lg border"
                      style={{
                        background: document.documentElement.classList.contains('dark') ? '#1e293b' : 'rgba(248,252,246,0.9)',
                        borderColor: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.05)' : 'rgba(140,185,135,0.25)',
                      }}>
                      <div className="flex-1">
                        <span className="text-slate-200 font-medium">{f.name}</span>
                        <div className="flex items-center gap-2 mt-2">
                          {/* Quantity input — recalculates from per100g baseline */}
                          <input
                            type="number" min="0.1" step="0.1"
                            value={f.qty}
                            onChange={(e) => {
                              const qty = parseFloat(e.target.value) || 1
                              const nutrients = recalcNutrition(f.per100g, qty, f.unit)
                              setFoods(prev => prev.map((item, idx) =>
                                idx === i ? { ...item, qty, ...nutrients } : item
                              ))
                            }}
                            className="input-field text-xs py-1 px-2 w-16"
                          />
                          {/* Unit selector — recalculates from per100g baseline */}
                          <select
                            value={f.unit}
                            onChange={(e) => {
                              const unit = e.target.value
                              const nutrients = recalcNutrition(f.per100g, f.qty, unit)
                              setFoods(prev => prev.map((item, idx) =>
                                idx === i ? { ...item, unit, ...nutrients } : item
                              ))
                            }}
                            className="select-field text-xs py-1 px-2"
                          >
                            <option value="g">grams (g)</option>
                            <option value="piece">piece</option>
                            <option value="bowl">bowl</option>
                            <option value="cup">cup</option>
                            <option value="serving">serving</option>
                          </select>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          {Math.round(f.qty * (UNIT_TO_GRAMS[f.unit] ?? 1))}g · P:{f.protein}g C:{f.carbs}g F:{f.fat}g
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-primary-400 font-bold">{f.calories} kcal</span>
                        <button onClick={() => removeFoodItem(i)} className="text-slate-500 hover:text-red-400 bg-white/5 p-1.5 rounded-lg"><RiDeleteBinLine size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 flex justify-between text-sm font-bold" style={{ borderTop: '1px solid rgba(140,185,135,0.2)' }}>
                    <span className="text-slate-300">Total Calories</span>
                    <span className="text-primary-400 text-lg">{foods.reduce((s, f) => s + (f.calories || 0), 0)} kcal</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button id="save-meal" onClick={handleSaveMeal} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : <><RiCheckLine /> Save Meal</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
