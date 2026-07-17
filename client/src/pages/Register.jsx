/**
 * pages/Register.jsx
 * Multi-step registration form with profile setup.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { RiHeartPulseLine, RiMailLine, RiLockLine, RiUserLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    height: '', weight: '', age: '', gender: 'male',
    goal: 'maintain', activityLevel: 'moderate',
  })

  const upd = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const nextStep = () => {
    if (step === 1) {
      if (!form.name || !form.email || !form.password)
        return toast.error('Please fill in all required fields')
      if (form.password.length < 8)
        return toast.error('Password must be at least 8 characters')
    }
    setStep(step + 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await register(form)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-surface-950">
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-accent-purple/8 rounded-full blur-3xl animate-pulse-slow" style={{animationDelay:'2s'}} />

      <div className="w-full max-w-md relative animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 mb-4 shadow-glow-green">
            <RiHeartPulseLine className="text-white text-3xl" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">HealthFit</h1>
          <p className="text-slate-400 mt-1 text-sm">Start your health journey</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s ? 'bg-primary-500 text-white' : 'bg-surface-800 text-slate-500'
              }`}>{s}</div>
              {s < 2 && <div className={`flex-1 h-0.5 transition-all ${step > s ? 'bg-primary-500' : 'bg-surface-700'}`} />}
              <span className={`text-xs font-medium ${step >= s ? 'text-slate-200' : 'text-slate-500'}`}>
                {s === 1 ? 'Account' : 'Profile'}
              </span>
            </div>
          ))}
        </div>

        <div className="glass-card p-8">
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-slate-100 mb-6">Create Account</h2>
              <div className="space-y-4">
                <div>
                  <label className="form-label">Full Name *</label>
                  <div className="relative">
                    <RiUserLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input id="reg-name" type="text" value={form.name} onChange={upd('name')}
                      placeholder="John Doe" className="input-field pl-11" required />
                  </div>
                </div>
                <div>
                  <label className="form-label">Email *</label>
                  <div className="relative">
                    <RiMailLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input id="reg-email" type="email" value={form.email} onChange={upd('email')}
                      placeholder="you@example.com" className="input-field pl-11" required />
                  </div>
                </div>
                <div>
                  <label className="form-label">Password *</label>
                  <div className="relative">
                    <RiLockLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input id="reg-password" type={showPass ? 'text' : 'password'} value={form.password}
                      onChange={upd('password')} placeholder="Min 8 characters"
                      className="input-field pl-11 pr-11" required />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPass ? <RiEyeOffLine /> : <RiEyeLine />}
                    </button>
                  </div>
                </div>
                <button id="reg-next" type="button" onClick={nextStep} className="btn-primary w-full py-3.5 mt-2">
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="animate-fade-in">
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Your Profile</h2>
              <p className="text-slate-400 text-sm mb-6">Optional — helps us personalize your calorie goals</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Height (cm)</label>
                    <input id="reg-height" type="number" value={form.height} onChange={upd('height')}
                      placeholder="170" className="input-field" min="50" max="300" />
                  </div>
                  <div>
                    <label className="form-label">Weight (kg)</label>
                    <input id="reg-weight" type="number" value={form.weight} onChange={upd('weight')}
                      placeholder="70" className="input-field" min="2" max="500" />
                  </div>
                  <div>
                    <label className="form-label">Age</label>
                    <input id="reg-age" type="number" value={form.age} onChange={upd('age')}
                      placeholder="25" className="input-field" min="10" max="120" />
                  </div>
                  <div>
                    <label className="form-label">Gender</label>
                    <select id="reg-gender" value={form.gender} onChange={upd('gender')} className="select-field">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label">Your Goal</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: 'lose_weight',     label: '🔥 Lose Weight' },
                      { v: 'gain_muscle',     label: '💪 Gain Muscle' },
                      { v: 'maintain',        label: '⚖️ Maintain' },
                      { v: 'improve_fitness', label: '🏃 Improve Fitness' },
                    ].map(({ v, label }) => (
                      <button type="button" key={v}
                        onClick={() => setForm({ ...form, goal: v })}
                        className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                          form.goal === v
                            ? 'border-primary-500 bg-primary-500/20 text-primary-600 dark:text-primary-400'
                            : 'border-slate-200 dark:border-white/10 bg-surface-100 dark:bg-surface-800 text-slate-600 dark:text-slate-400 hover:border-primary-500/40'
                        }`}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">Activity Level</label>
                  <select id="reg-activity" value={form.activityLevel} onChange={upd('activityLevel')} className="select-field">
                    <option value="sedentary">Sedentary (desk job)</option>
                    <option value="light">Light (1-3 days/week)</option>
                    <option value="moderate">Moderate (3-5 days/week)</option>
                    <option value="active">Active (6-7 days/week)</option>
                    <option value="very_active">Very Active (athlete)</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
                  <button id="reg-submit" type="submit" disabled={loading} className="btn-primary flex-1">
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating...
                      </span>
                    ) : 'Create Account 🎉'}
                  </button>
                </div>
              </div>
            </form>
          )}

          <p className="text-center text-sm text-slate-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
