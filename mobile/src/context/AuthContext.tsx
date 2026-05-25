import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { MeResponse, StudentProfile } from '../types'

type AuthContextValue = {
  session: Session | null
  me: MeResponse | null
  profile: StudentProfile | null
  loading: boolean
  refreshing: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: {
    email: string
    password: string
    fullName: string
    dateOfBirth: string
  }) => Promise<{ requiresEmailConfirmation: boolean }>
  signOut: () => Promise<void>
  refreshBootstrap: () => Promise<void>
  updateProfile: (payload: Record<string, unknown>) => Promise<StudentProfile>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<MeResponse | null>(null)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshBootstrap = useCallback(async () => {
    const nextSession = (await supabase.auth.getSession()).data.session
    setSession(nextSession)

    if (!nextSession?.access_token) {
      setMe(null)
      setProfile(null)
      setError(null)
      setLoading(false)
      return
    }

    setRefreshing(true)
    try {
      const [nextMe, profileResponse] = await Promise.all([
        apiFetch<MeResponse>('/api/me', { method: 'GET', accessToken: nextSession.access_token }),
        apiFetch<{ success: boolean; profile: StudentProfile }>('/api/profile', {
          method: 'GET',
          accessToken: nextSession.access_token,
        }),
      ])

      setMe(nextMe)
      setProfile(profileResponse.profile)
      setError(null)
    } catch (refreshError) {
      setMe(null)
      setProfile(null)
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Could not load your account right now.'
      )
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshBootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void refreshBootstrap()
    })

    return () => subscription.unsubscribe()
  }, [refreshBootstrap])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw error
    }
    await refreshBootstrap()
  }, [refreshBootstrap])

  const signUp = useCallback(
    async (input: { email: string; password: string; fullName: string; dateOfBirth: string }) => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
            date_of_birth: input.dateOfBirth,
          },
        },
      })

      if (error) {
        throw error
      }

      if (data.session) {
        await refreshBootstrap()
      }

      return {
        requiresEmailConfirmation: !data.session,
      }
    },
    [refreshBootstrap]
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
    setSession(null)
    setMe(null)
    setProfile(null)
    setError(null)
  }, [])

  const updateProfile = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!session?.access_token) {
        throw new Error('Please sign in again.')
      }

      const response = await apiFetch<{ success: boolean; profile: StudentProfile }>('/api/profile', {
        method: 'PUT',
        accessToken: session.access_token,
        body: JSON.stringify(payload),
      })

      setProfile(response.profile)
      await refreshBootstrap()
      return response.profile
    },
    [refreshBootstrap, session?.access_token]
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      me,
      profile,
      loading,
      refreshing,
      error,
      signIn,
      signUp,
      signOut,
      refreshBootstrap,
      updateProfile,
    }),
    [error, loading, me, profile, refreshBootstrap, refreshing, session, signIn, signOut, signUp, updateProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}
