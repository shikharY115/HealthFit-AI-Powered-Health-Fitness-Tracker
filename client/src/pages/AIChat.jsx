/**
 * pages/AIChat.jsx
 * AI-powered Chatbot with persistent history.
 * Supports dual-mode: natural language meal tracking and health Q&A.
 */
import { useState, useRef, useEffect } from 'react'
import { aiApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  RiRobotLine, RiSendPlaneLine, RiSparklingLine
} from 'react-icons/ri'

const SUGGESTIONS = [
  'I ate 3 chapatis, 1 bowl dal, and 100g curd',
  'How many calories should I eat to lose weight?',
  'Chicken biryani with raita for lunch',
  'What are the best pre-workout foods?',
]

const TypingIndicator = () => (
  <div className="flex gap-1.5 p-3">
    {[0,1,2].map(i => (
      <div key={i} className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
    ))}
  </div>
)

export default function AIChat() {
  const [messages, setMessages] = useState([{
    role: 'ai',
    content: '👋 Hello! I\'m your AI health assistant.\n\nTell me what you ate to track calories, or ask me any health and fitness question!',
    timestamp: new Date(),
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    aiApi.getStatus().then(res => setAiStatus(res.data)).catch(() => {})
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const res = await aiApi.getHistory()
      if (res.data && res.data.length > 0) {
        const hist = res.data.map(m => {
          let content = m.message
          // Format meal data if it was a meal analysis
          if (m.type === 'meal' && m.data && m.data.foods) {
            const a = m.data
            const lines = [
              `**Meal Analysis Complete**`,
              '',
              `**Total Calories:** ${a.totalCalories} kcal`,
              `**Macros:** Protein ${a.totalProtein}g · Carbs ${a.totalCarbs}g · Fat ${a.totalFat}g`,
              '',
              '**Foods detected:**',
              ...(a.foods || []).map(f => `• ${f.name} (${f.quantity || '~100g'}) — ${f.calories} kcal`),
              '',
              ...(a.suggestions && a.suggestions.length > 0 ? ['**💡 Suggestions:**', ...a.suggestions.map(s => `• ${s}`)] : []),
            ]
            content = lines.join('\n')
          }
          return {
            role: m.sender === 'user' ? 'user' : 'ai',
            content,
            timestamp: m.createdAt,
            type: m.type
          }
        })
        setMessages(prev => [prev[0], ...hist])
      }
    } catch (error) {
      console.error("Failed to load history", error)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')

    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date() }])
    setLoading(true)

    try {
      const res = await aiApi.chat(msg)
      const aiRecord = res.data

      let content = aiRecord.message
      if (aiRecord.type === 'meal' && aiRecord.data && aiRecord.data.foods) {
        const a = aiRecord.data
        const lines = [
          `**Meal Analysis Complete** ✅ Added to tracker!`,
          '',
          `**Total Calories:** ${a.totalCalories} kcal`,
          `**Macros:** Protein ${a.totalProtein}g · Carbs ${a.totalCarbs}g · Fat ${a.totalFat}g`,
          '',
          '**Foods detected:**',
          ...(a.foods || []).map(f => `• ${f.name} (${f.quantity || '~100g'}) — ${f.calories} kcal`),
          '',
          ...(a.suggestions && a.suggestions.length > 0 ? ['**💡 Suggestions:**', ...a.suggestions.map(s => `• ${s}`)] : []),
        ]
        content = lines.join('\n')

        // Also call the legacy analyzeMeal endpoint in background just to save to Meal tracker!
        aiApi.analyzeMeal({ mealText: msg, autoSave: true, mealType: 'lunch' }).catch(()=>{})
      }

      setMessages(prev => [...prev, { role: 'ai', content, timestamp: new Date(), type: aiRecord.type }])

    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: `❌ ${err.message || 'Something went wrong. Please try again.'}`, timestamp: new Date() }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const renderMessage = (msg) => {
    const lines = msg.content.split('\n')
    return lines.map((line, i) => {
      if (!line) return <br key={i} />
      // Bold text
      const parts = line.split(/\*\*(.*?)\*\*/)
      return (
        <p key={i} className={`text-sm leading-relaxed ${line.startsWith('•') ? 'ml-2' : ''}`}>
          {parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-slate-100 font-semibold">{p}</strong> : p)}
        </p>
      )
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      {/* Header */}
      <div className="page-header mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <RiRobotLine className="text-cyan-400" /> AI Health Assistant
            </h1>
            <p className="page-subtitle">Analyze meals, track calories, ask health questions</p>
          </div>
          {/* AI Status badge */}
          {aiStatus && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs"
              style={{ background: 'rgba(100,160,100,0.10)', borderColor: 'rgba(120,180,120,0.25)' }}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${aiStatus.aiPowered ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className="text-slate-400">{aiStatus.aiProvider}</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 glass-card p-4 overflow-y-auto mb-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 animate-slide-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                <RiRobotLine className="text-white text-sm" />
              </div>
            )}
            <div className={msg.role === 'user' ? 'chat-bubble-user' : `chat-bubble-ai ${msg.type === 'meal' ? 'border-cyan-500/30' : ''}`}>
              <div className="space-y-0.5">{renderMessage(msg)}</div>
              <p className="text-xs opacity-50 mt-2">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-white text-xs font-bold">U</span>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <RiRobotLine className="text-white text-sm" />
            </div>
            <div className="chat-bubble-ai">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">❓ Try these examples:</p>
          <div className="flex gap-2 flex-wrap">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)}
                className="text-xs px-3 py-2 rounded-xl border transition-all text-slate-400 hover:text-slate-200 hover:border-primary-500/50"
                style={{ background: 'rgba(100,160,100,0.08)', borderColor: 'rgba(120,180,120,0.22)' }}>
                {s.length > 45 ? s.substring(0, 45) + '...' : s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="glass-card p-3 flex gap-3">
        <textarea
          id="ai-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Message AI Assistant... (Press Enter to send)'
          className="input-field flex-1 min-h-[52px] max-h-32 resize-none py-3"
          rows={1}
          disabled={loading}
        />
        <button
          id="ai-send"
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="btn-primary px-4 self-end h-[52px] aspect-square flex items-center justify-center"
        >
          <RiSendPlaneLine size={18} />
        </button>
      </div>
      <p className="text-xs text-slate-600 mt-2 text-center">
        <RiSparklingLine className="inline mr-1" />
        Powered by {aiStatus?.aiProvider || 'AI'} · Nutrition data from {aiStatus?.nutritionProvider || 'Edamam'}
      </p>
    </div>
  )
}
