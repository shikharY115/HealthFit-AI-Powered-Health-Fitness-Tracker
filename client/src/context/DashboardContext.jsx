/**
 * context/DashboardContext.jsx
 * Caches dashboard API data globally so navigating back to the Dashboard
 * does NOT re-fire all 6 API calls. Data is considered stale after 60s
 * and silently refreshed in the background (stale-while-revalidate).
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { calorieApi, workoutApi, stepsApi, bmiApi } from '../services/api'

const DashboardContext = createContext(null)

const STALE_MS = 60_000 // 60 seconds

const EMPTY = {
  todayCalories: 0, todayBurned: 0, todaySteps: 0,
  latestBMI: null, calorieStats: [], workoutStats: [], macros: null,
  dailyGoal: 2000, stepGoal: 10000,
}

export function DashboardProvider({ children }) {
  const [data, setData]       = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded]   = useState(false)   // true once first fetch done
  const lastFetchRef          = useRef(0)          // timestamp of last successful fetch
  const fetchingRef           = useRef(false)      // guard against double-fetch

  const fetchDashboard = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    const isStale = now - lastFetchRef.current > STALE_MS

    // Skip if: already fetching, OR data is fresh AND not forced
    if (fetchingRef.current) return
    if (!force && !isStale && loaded) return

    fetchingRef.current = true
    // Only show blocking spinner on very first load
    if (!loaded) setLoading(true)

    try {
      const [mealsRes, calorieStatsRes, workoutStatsRes, stepsRes, bmiRes, macrosRes] =
        await Promise.allSettled([
          calorieApi.getMeals(),
          calorieApi.getStats(),
          workoutApi.getStats(),
          stepsApi.getTodaySteps(),
          bmiApi.getHistory(1),
          calorieApi.getMacros(),
        ])

      const get = (res) => res.status === 'fulfilled' ? res.value : null
      const meals     = get(mealsRes)
      const calStats  = get(calorieStatsRes)
      const workStats = get(workoutStatsRes)
      const steps     = get(stepsRes)
      const bmi       = get(bmiRes)
      const macros    = get(macrosRes)

      const today = new Date().toISOString().split('T')[0]
      const todayBurned = workStats?.data
        ?.filter(d => d.date === today)
        .reduce((s, d) => s + (d.totalCaloriesBurned || 0), 0) || 0

      setData({
        todayCalories: meals?.totals?.calories || 0,
        todayBurned,
        todaySteps:  steps?.data?.steps       || 0,
        latestBMI:   bmi?.data?.[0]           || null,
        calorieStats: calStats?.data          || [],
        workoutStats: workStats?.data         || [],
        macros:       macros?.data            || null,
        dailyGoal:    meals?.dailyGoal        || 2000,
        stepGoal:     steps?.data?.goalSteps  || 10000,
        googleFitConnected: steps?.data?.googleFitConnected || false,
        lastSynced:   steps?.data?.lastSynced || null,
        syncError:    steps?.data?.syncError  || null,
      })

      lastFetchRef.current = Date.now()
      setLoaded(true)
    } catch (e) {
      console.error('[Dashboard] Load error:', e)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [loaded])

  /** Call this after a user action that mutates data (log meal, sync steps, etc.) */
  const invalidate = useCallback(() => {
    lastFetchRef.current = 0
  }, [])

  return (
    <DashboardContext.Provider value={{ data, loading, loaded, fetchDashboard, invalidate }}>
      {children}
    </DashboardContext.Provider>
  )
}

export const useDashboard = () => {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
