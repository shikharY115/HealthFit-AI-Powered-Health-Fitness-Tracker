/**
 * client/src/context/AuthContext.jsx
 * Global authentication state management.
 * Provides user state, login/logout/register actions to all components.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // initial auth check

  // Check if user is already logged in (on app load)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await authApi.getMe()
        setUser(res.user)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()

    // Listen for 401 unauthorized events from Axios interceptor
    const handleUnauthorized = () => {
      setUser(null)
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  const register = useCallback(async (formData) => {
    const res = await authApi.register(formData)
    setUser(res.user)
    toast.success(`Welcome to HealthFit, ${res.user.name}! 🎉`)
    return res
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password })
    setUser(res.user)
    toast.success(`Welcome back, ${res.user.name}! 💪`)
    return res
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch { /* ignore */ }
    setUser(null)
    toast.success('Logged out. See you soon!')
  }, [])

  const updateUser = useCallback(async (data) => {
    const res = await authApi.updateProfile(data)
    setUser(res.user)
    toast.success('Profile updated!')
    return res
  }, [])

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    updateUser,
    setUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook for consuming auth context
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
