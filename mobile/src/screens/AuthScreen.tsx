import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { Card, Field, InlineError, PrimaryButton, Screen, SecondaryButton } from '../components/UI'
import { colors } from '../theme'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async () => {
    if (loading) {
      return
    }

    setError(null)
    setNotice(null)

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.')
      return
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Full name is required.')
        return
      }
      if (!dateOfBirth.trim()) {
        setError('Date of birth is required.')
        return
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        const result = await signUp({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          dateOfBirth,
        })

        if (result.requiresEmailConfirmation) {
          setNotice('Check your email, confirm the account, then sign in from the app.')
          setMode('login')
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen
      title="ScholarHAAB Mobile"
      subtitle="Sign in to keep your chats, files, history, and study context synced on mobile."
    >
      <Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SecondaryButton label="Login" onPress={() => setMode('login')} disabled={mode === 'login' || loading} />
          <SecondaryButton label="Sign up" onPress={() => setMode('signup')} disabled={mode === 'signup' || loading} />
        </View>
        {mode === 'signup' ? (
          <>
            <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" />
            <Field label="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" />
          </>
        ) : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        <InlineError message={error} />
        {notice ? <Text style={{ color: colors.accent, lineHeight: 22 }}>{notice}</Text> : null}
        <PrimaryButton label={loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} disabled={loading} />
      </Card>
    </Screen>
  )
}
