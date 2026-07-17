/**
 * pages/StepTracker.jsx
 * Step tracking with Google Fit OAuth integration and manual entry.
 */
import { useState, useEffect } from 'react'
import { stepsApi } from '../services/api'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import toast from 'react-hot-toast'
import {
  RiFootprintLine, RiGoogleLine, RiLinkUnlink,
  RiCheckLine, RiSettingsLine, RiInformationLine
} from 'react-icons/ri'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function StepTracker() {
  const [todayData, setTodayData] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [manualSteps, setManualSteps] = useState('')
  const [saving, setSaving] = useState(false)
  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [autoSyncError, setAutoSyncError] = useState(null) // from background load, less alarming
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Handle Google Fit callback redirect parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'google_fit_connected') {
      toast.success('✅ Google Fit connected! Syncing your steps...')
      window.history.replaceState({}, '', '/steps')
    } else if (params.get('error')) {
      toast.error(`Google Fit error: ${params.get('error').replace(/_/g, ' ')}`)
      window.history.replaceState({}, '', '/steps')
    }
  }, [])

  const loadData = async (showSyncErrors = false) => {
    setLoading(true)
    if (showSyncErrors) setSyncError(null)
    try {
      const [todayRes, histRes] = await Promise.allSettled([
        stepsApi.getTodaySteps(),
        stepsApi.getHistory(),
      ])
      const get = (r) => r.status === 'fulfilled' ? r.value : null
      const todayPayload = get(todayRes)?.data || null
      setTodayData(todayPayload)
      setHistory(get(histRes)?.data || [])
      // Background auto-sync errors go to autoSyncError (less alarming)
      // Manual sync errors go to syncError (red banner)
      if (todayPayload?.syncError) {
        if (showSyncErrors) setSyncError(todayPayload.syncError)
        else setAutoSyncError(todayPayload.syncError)
      } else {
        setAutoSyncError(null)
      }
    } catch (e) { console.error('Steps load error:', e) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true)
    try {
      const res = await stepsApi.getGoogleAuthUrl()
      if (res.data?.authUrl) {
        // Redirect to Google OAuth
        window.location.href = res.data.authUrl
      } else {
        toast.error(res.message || 'Google Fit not configured on server')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to connect Google Fit')
    } finally {
      setConnectingGoogle(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    setSyncError(null)
    setAutoSyncError(null)
    try {
      const res = await stepsApi.syncGoogleFit()
      toast.success(res.message || '✅ Steps synced from Google Fit')
      await loadData(true)
    } catch (err) {
      const msg = err.message || 'Sync failed'
      setSyncError(msg)
      // If backend says token is permanently revoked, update connection status
      if (err.needsReconnect) {
        setTodayData(prev => ({ ...prev, googleFitConnected: false }))
        toast.error('Google Fit token expired. Please reconnect.')
      } else {
        toast.error(msg)
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await stepsApi.disconnectGoogleFit()
      toast.success('Google Fit disconnected')
      setSyncError(null)
      setTodayData(prev => ({ ...prev, googleFitConnected: false }))
    } catch { toast.error('Failed to disconnect') }
  }

  const handleManualUpdate = async () => {
    if (!manualSteps || parseInt(manualSteps) < 0) return toast.error('Please enter a valid step count')
    setSaving(true)
    try {
      await stepsApi.updateSteps({ steps: parseInt(manualSteps), source: 'manual' })
      toast.success(`✅ Steps updated: ${parseInt(manualSteps).toLocaleString()}`)
      setManualSteps('')
      await loadData()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const todaySteps = todayData?.steps || 0
  const goalSteps = todayData?.goalSteps || 10000
  const stepPercent = Math.min(100, Math.round((todaySteps / goalSteps) * 100))

  const barData = {
    labels: history.map(d => new Date(d.date).toLocaleDateString('en', { weekday: 'short' })),
    datasets: [{
      label: 'Steps',
      data: history.map(d => d.steps),
      backgroundColor: history.map(d => d.goalAchieved ? 'rgba(34,197,94,0.7)' : 'rgba(59,130,246,0.7)'),
      borderRadius: 8, borderSkipped: false,
    }],
  }

  const SETUP_STEPS = [
    { n: 1, text: 'Go to Google Cloud Console', url: 'https://console.cloud.google.com/' },
    { n: 2, text: 'Create project → Enable "Fitness API"' },
    { n: 3, text: 'Create OAuth 2.0 Web credentials' },
    { n: 4, text: 'Add redirect: http://localhost:5000/api/steps/google/callback' },
    { n: 5, text: 'Add GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET to server/.env' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><RiFootprintLine className="text-blue-400" /> Step Tracker</h1>
        <p className="page-subtitle">Connect your wearable device or log steps manually</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's steps gauge */}
        <div className="glass-card p-6">
          <h2 className="font-semibold text-slate-200 mb-4">Today's Steps</h2>

          {/* Circular progress */}
          <div className="flex flex-col items-center py-4">
            <div className="relative w-44 h-44">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42"
                  stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(100,155,100,0.18)'}
                  strokeWidth="10" fill="none" />
                <circle cx="50" cy="50" r="42" stroke="url(#stepGrad)" strokeWidth="10" fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - stepPercent / 100)}`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="stepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold text-slate-100">{todaySteps.toLocaleString()}</p>
                <p className="text-xs text-slate-500">of {goalSteps.toLocaleString()}</p>
                <p className="text-sm font-semibold text-blue-400">{stepPercent}%</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full mt-4 text-center">
              {[
                { label: 'Calories', val: `${todayData?.caloriesBurned || 0} kcal`, color: 'text-orange-400' },
                { label: 'Distance', val: `${todayData?.distanceKm || 0} km`, color: 'text-blue-400' },
                { label: 'Status', val: todayData?.goalAchieved ? '🎯 Goal!' : '⏳ Going', color: todayData?.goalAchieved ? 'text-green-400' : 'text-yellow-400' },
              ].map(({ label, val, color }) => (
                <div key={label}>
                  <p className={`font-semibold text-sm ${color}`}>{val}</p>
                  <p className="text-xs text-slate-600">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Source badge */}
          <div className="flex items-center justify-between mt-4 p-3 rounded-xl bg-surface-900/50">
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${todayData?.source === 'google_fit' ? 'bg-blue-400' : isDark ? 'bg-slate-500' : 'bg-green-400'}`} />
              <span className="text-slate-400">Source: <span className="text-slate-200 font-medium capitalize">{todayData?.source?.replace('_', ' ') || 'Manual'}</span></span>
            </div>
            {todayData?.lastSynced && (
              <span className="text-xs text-slate-600">Synced: {new Date(todayData.lastSynced).toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        {/* Right panel: Google Fit + Manual */}
        <div className="space-y-4">
          {/* Google Fit connection */}
          <div className="glass-card p-6">
            <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <RiGoogleLine className="text-blue-400" /> Google Fit Integration
            </h2>

            {/* Manual sync error banner (red — shown after explicit Sync Now) */}
            {syncError && (
              <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2">
                <span className="text-red-400 text-base flex-shrink-0">⚠️</span>
                <div className="flex-1">
                  <p className="text-xs text-red-400 font-semibold">Sync Error</p>
                  <p className="text-xs text-slate-400 mt-0.5">{syncError}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={async () => { await handleDisconnect(); setSyncError(null) }}
                      className="text-xs text-blue-400 underline hover:text-blue-300"
                    >
                      Reconnect Google Fit →
                    </button>
                    <button onClick={() => setSyncError(null)} className="text-xs text-slate-500 hover:text-slate-400">Dismiss</button>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-sync warning banner (amber — shown on background load failure) */}
            {!syncError && autoSyncError && (
              <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                <span className="text-amber-400 text-base flex-shrink-0">⚠️</span>
                <div className="flex-1">
                  <p className="text-xs text-amber-400 font-semibold">Background Sync Issue</p>
                  <p className="text-xs text-slate-400 mt-0.5">Could not auto-sync from Google Fit. Your last saved data is shown.</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={handleSyncNow} disabled={syncing} className="text-xs text-blue-400 underline hover:text-blue-300">Retry Sync</button>
                    <button onClick={async () => { await handleDisconnect(); setAutoSyncError(null) }} className="text-xs text-slate-500 hover:text-slate-400">Reconnect</button>
                    <button onClick={() => setAutoSyncError(null)} className="text-xs text-slate-500 hover:text-slate-400">Dismiss</button>
                  </div>
                </div>
              </div>
            )}

            {todayData?.googleFitConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <RiCheckLine /> <span>Google Fit connected ✅</span>
                </div>
                <div className="flex gap-3">
                  <button
                    id="sync-google-fit"
                    onClick={handleSyncNow}
                    disabled={syncing}
                    className="btn-primary flex-1 text-sm py-2"
                  >
                    {syncing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Syncing...
                      </span>
                    ) : '🔄 Sync Now'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-all"
                  >
                    <RiLinkUnlink /> Disconnect
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Last synced: {todayData?.lastSynced ? new Date(todayData.lastSynced).toLocaleTimeString() : 'Never'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">Connect your Google account to automatically sync step data from Google Fit and wearable devices.</p>
                <button id="connect-google-fit" onClick={handleConnectGoogle} disabled={connectingGoogle}
                  className="btn-primary w-full gap-2">
                  <RiGoogleLine />
                  {connectingGoogle ? 'Connecting...' : 'Connect Google Fit'}
                </button>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <RiInformationLine className="text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-400">Supports: Google Fit, Fitbit, Samsung Health, Garmin (via Google Fit sync)</p>
                </div>
              </div>
            )}
          </div>

          {/* Manual step entry */}
          <div className="glass-card p-6">
            <h2 className="font-semibold text-slate-200 mb-4">Manual Entry</h2>
            <div className="flex gap-3">
              <input id="manual-steps" type="number" value={manualSteps}
                onChange={e => setManualSteps(e.target.value)}
                placeholder="Enter step count" className="input-field flex-1" min="0" max="100000" />
              <button id="update-steps" onClick={handleManualUpdate} disabled={saving} className="btn-primary px-5">
                {saving ? '...' : <RiCheckLine size={18} />}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-2">Manually set today's step count from your phone or fitness tracker</p>
          </div>

          {/* Google Cloud setup guide */}
          {!todayData?.googleFitConnected && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <RiSettingsLine /> Google Fit Setup Guide
              </h3>
              <div className="space-y-2">
                {SETUP_STEPS.map(({ n, text, url }) => (
                  <div key={n} className="flex items-start gap-3 text-xs">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">{n}</span>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">{text}</a>
                    ) : (
                      <span className="text-slate-400">{text}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weekly bar chart */}
      <div className="glass-card p-6">
        <h2 className="font-semibold text-slate-200 mb-4">Weekly Step History</h2>
        <div className="h-52">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500">Loading...</div>
          ) : (
            <Bar key={`steps-${isDark}`} data={barData} options={{
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
          )}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500/70" /> Goal achieved</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500/70" /> Below goal</div>
        </div>
      </div>
    </div>
  )
}
