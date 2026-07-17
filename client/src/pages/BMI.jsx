/**
 * pages/BMI.jsx
 * BMI calculator with visual gauge, history chart, and ideal weight info.
 */
import { useState, useEffect } from 'react'
import { bmiApi } from '../services/api'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import toast from 'react-hot-toast'
import { RiScales3Line, RiDeleteBinLine, RiInformationLine } from 'react-icons/ri'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const CATEGORIES = {
  'Underweight':    { color: '#60a5fa', bg: 'bg-blue-500/10',   text: 'text-blue-400',   range: '< 18.5' },
  'Normal weight':  { color: '#4ade80', bg: 'bg-green-500/10',  text: 'text-green-400',  range: '18.5 – 24.9' },
  'Overweight':     { color: '#facc15', bg: 'bg-yellow-500/10', text: 'text-yellow-400', range: '25 – 29.9' },
  'Obese':          { color: '#f97316', bg: 'bg-orange-500/10', text: 'text-orange-400', range: '30 – 34.9' },
  'Severely Obese': { color: '#f87171', bg: 'bg-red-500/10',    text: 'text-red-400',    range: '≥ 35' },
}

/** BMI gauge needle component */
const BMIGauge = ({ bmi, isDark }) => {
  const min = 14, max = 40
  const clamp = Math.min(max, Math.max(min, bmi || min))
  const pct = (clamp - min) / (max - min)
  const angle = pct * 180 - 90

  const needleColor = isDark ? 'white' : '#1a2e1a'
  const circleColor = isDark ? 'white' : '#2d4a2d'
  const textColor   = isDark ? 'white' : '#1a2e1a'

  return (
    <div className="relative flex flex-col items-center">
      <svg width="220" height="120" viewBox="0 0 220 120">
        {[
          { color: '#60a5fa', start: 0,   end: 36  },
          { color: '#4ade80', start: 36,  end: 90  },
          { color: '#facc15', start: 90,  end: 130 },
          { color: '#f97316', start: 130, end: 157 },
          { color: '#f87171', start: 157, end: 180 },
        ].map(({ color, start, end }, i) => {
          const toRad = (d) => ((d - 90) * Math.PI) / 180
          const x1 = 110 + 95 * Math.cos(toRad(start))
          const y1 = 110 + 95 * Math.sin(toRad(start))
          const x2 = 110 + 95 * Math.cos(toRad(end))
          const y2 = 110 + 95 * Math.sin(toRad(end))
          const large = end - start > 90 ? 1 : 0
          return (
            <g key={i}>
              <path
                d={`M 110 110 L ${x1} ${y1} A 95 95 0 ${large} 1 ${x2} ${y2} Z`}
                fill={color} opacity="0.2"
              />
              <path
                d={`M ${110 + 70 * Math.cos(toRad(start))} ${110 + 70 * Math.sin(toRad(start))} A 70 70 0 ${large} 1 ${110 + 70 * Math.cos(toRad(end))} ${110 + 70 * Math.sin(toRad(end))}`}
                stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
              />
            </g>
          )
        })}
        {/* Needle */}
        <g transform={`rotate(${angle}, 110, 110)`}>
          <line x1="110" y1="110" x2="110" y2="30" stroke={needleColor} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="110" cy="110" r="6" fill={circleColor} />
        </g>
        {bmi && (
          <text x="110" y="105" textAnchor="middle" fill={textColor} fontSize="20" fontWeight="700" fontFamily="Inter">
            {bmi}
          </text>
        )}
      </svg>
    </div>
  )
}

export default function BMI() {
  const [form, setForm] = useState({ height: '', weight: '', unit: 'metric' })
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    bmiApi.getHistory().then(res => setHistory(res.data || [])).catch(() => {}).finally(() => setLoadingHistory(false))
  }, [])

  const handleCalculate = async (e) => {
    e.preventDefault()
    if (!form.height || !form.weight) return toast.error('Please enter height and weight')
    setLoading(true)
    try {
      const res = await bmiApi.calculate(form)
      setResult(res.data)
      toast.success(`BMI calculated: ${res.data.bmi} (${res.data.category})`)
      // Refresh history
      const hist = await bmiApi.getHistory()
      setHistory(hist.data || [])
    } catch (err) {
      toast.error(err.message)
    } finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    try {
      await bmiApi.deleteRecord(id)
      setHistory(history.filter(r => r._id !== id))
      toast.success('Record deleted')
    } catch { toast.error('Failed to delete') }
  }

  const cat = result ? CATEGORIES[result.category] : null

  // Chart data
  const chartData = {
    labels: [...history].reverse().map(r => new Date(r.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'BMI',
      data: [...history].reverse().map(r => r.bmi),
      borderColor: '#22c55e',
      backgroundColor: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.10)',
      fill: true, tension: 0.4,
      pointBackgroundColor: [...history].reverse().map(r => CATEGORIES[r.category]?.color || '#22c55e'),
      pointRadius: 5, pointHoverRadius: 7,
    }],
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><RiScales3Line className="text-primary-400" /> BMI Calculator</h1>
        <p className="page-subtitle">Calculate your Body Mass Index and track your progress over time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculator */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-6">Calculate BMI</h2>
          <form onSubmit={handleCalculate} className="space-y-4">
            {/* Unit toggle */}
            <div className="flex bg-surface-900 rounded-xl p-1 gap-1">
              {['metric', 'imperial'].map(u => (
                <button key={u} type="button"
                  onClick={() => setForm({ ...form, unit: u })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    form.unit === u ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}>
                  {u === 'metric' ? 'Metric (cm/kg)' : 'Imperial (in/lbs)'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Height ({form.unit === 'metric' ? 'cm' : 'inches'})</label>
                <input id="bmi-height" type="number" value={form.height}
                  onChange={e => setForm({ ...form, height: e.target.value })}
                  placeholder={form.unit === 'metric' ? '170' : '67'} className="input-field"
                  min="1" step="0.1" required />
              </div>
              <div>
                <label className="form-label">Weight ({form.unit === 'metric' ? 'kg' : 'lbs'})</label>
                <input id="bmi-weight" type="number" value={form.weight}
                  onChange={e => setForm({ ...form, weight: e.target.value })}
                  placeholder={form.unit === 'metric' ? '70' : '154'} className="input-field"
                  min="1" step="0.1" required />
              </div>
            </div>

            <button id="bmi-calculate" type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Calculating...' : '⚖️ Calculate BMI'}
            </button>
          </form>

          {/* Result */}
          {result && (
            <div className={`mt-6 rounded-2xl p-5 ${cat.bg} border border-white/5 animate-bounce-in`}>
              <BMIGauge bmi={result.bmi} isDark={isDark} />
              <div className="text-center mt-2">
                <p className={`text-4xl font-bold ${cat.text}`}>{result.bmi}</p>
                <p className={`text-lg font-semibold mt-1 ${cat.text}`}>{result.category}</p>
                <p className="text-sm text-slate-400 mt-2">
                  Ideal weight range: <span className="text-slate-200 font-medium">{result.idealWeightMin}–{result.idealWeightMax} kg</span>
                </p>
                {result.estimatedBodyFat && (
                  <p className="text-sm text-slate-400">
                    Est. body fat: <span className="text-slate-200 font-medium">{result.estimatedBodyFat}%</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* BMI Categories Info */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <RiInformationLine className="text-accent-blue" /> BMI Categories
          </h2>
          <div className="space-y-3">
            {Object.entries(CATEGORIES).map(([label, { color, bg, text, range }]) => (
              <div key={label} className={`flex items-center justify-between p-3 rounded-xl ${bg} border border-white/5`}>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className={`font-medium text-sm ${text}`}>{label}</span>
                </div>
                <span className="text-slate-400 text-sm">{range}</span>
              </div>
            ))}
          </div>

          {/* History chart */}
          {history.length > 1 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">BMI History</h3>
              <div className="h-36">
                <Line key={`bmi-${isDark}`} data={chartData} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: isDark ? '#1e293b' : '#f0faf0',
                      titleColor: isDark ? '#e2e8f0' : '#1a2e1a',
                      bodyColor:  isDark ? '#94a3b8' : '#4a6a48',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(120,180,120,0.25)',
                      borderWidth: 1
                    }
                  },
                  scales: {
                    x: { ticks: { color: isDark ? '#64748b' : '#5a7a58', font: { size: 9 } }, grid: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(100,155,100,0.09)' } },
                    y: { ticks: { color: isDark ? '#64748b' : '#5a7a58', font: { size: 9 } }, grid: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(100,155,100,0.09)' } },
                  },
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History table */}
      {history.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">BMI History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-white/5">
                  <th className="text-left py-3 pr-4">Date</th>
                  <th className="text-left py-3 pr-4">BMI</th>
                  <th className="text-left py-3 pr-4">Category</th>
                  <th className="text-left py-3 pr-4">Height</th>
                  <th className="text-left py-3 pr-4">Weight</th>
                  <th className="text-right py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map(r => {
                  const c = CATEGORIES[r.category]
                  return (
                    <tr key={r._id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="py-3 pr-4 text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4 font-bold" style={{ color: c?.color }}>{r.bmi}</td>
                      <td className="py-3 pr-4">
                        <span className={`badge ${c?.bg} ${c?.text}`}>{r.category}</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-300">{r.height} cm</td>
                      <td className="py-3 pr-4 text-slate-300">{r.weight} kg</td>
                      <td className="py-3 text-right">
                        <button onClick={() => handleDelete(r._id)} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                          <RiDeleteBinLine size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
