import React, { useState } from 'react'
import { Text, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useAuth } from '../context/AuthContext'
import { Card, InlineError, PrimaryButton, Screen, SecondaryButton } from '../components/UI'
import { apiFetch } from '../lib/api'
import { mobileEnv } from '../lib/env'
import { getTierLabel, MOBILE_PLAN_PRICES } from '../lib/plans'
import { colors } from '../theme'

export function SettingsScreen() {
  const { me, profile, refreshing, error, refreshBootstrap, signOut, session } = useAuth()
  const [actionError, setActionError] = useState<string | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState<'pro' | 'premium' | null>(null)

  const openUpgrade = async (tier: 'pro' | 'premium') => {
    if (!session?.access_token) {
      setActionError('Please sign in again to continue.')
      return
    }

    setUpgradeLoading(tier)
    setActionError(null)
    try {
      const response = await apiFetch<{ url?: string; error?: string }>('/api/payment/initiate', {
        method: 'POST',
        accessToken: session.access_token,
        body: JSON.stringify({ tier, gateway: 'bkash' }),
      })

      if (!response.url) {
        throw new Error('Payment URL was not returned by the server.')
      }

      await WebBrowser.openBrowserAsync(response.url)
    } catch (upgradeError) {
      setActionError(
        upgradeError instanceof Error ? upgradeError.message : 'Could not open payment flow.'
      )
    } finally {
      setUpgradeLoading(null)
    }
  }

  return (
    <Screen title="Settings" subtitle="Manage your account, plan, and sync health.">
      <Card>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Account</Text>
        <Text style={{ color: colors.mutedText, lineHeight: 22 }}>
          {profile?.fullName ?? 'Student'}
          {'\n'}
          {profile?.email ?? 'No email'}
          {'\n'}
          Tier: {getTierLabel(me?.tier)}
        </Text>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Study defaults</Text>
        <Text style={{ color: colors.mutedText, lineHeight: 22 }}>
          Board: {profile?.preferredBoard ?? 'Not set'}
          {'\n'}
          Level: {profile?.preferredLevel ?? 'Not set'}
          {'\n'}
          Subjects: {profile?.preferredSubjects?.join(', ') || 'Not set'}
          {'\n'}
          Target country: {profile?.targetCountry ?? 'Not set'}
        </Text>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Subscription</Text>
        <Text style={{ color: colors.mutedText, lineHeight: 22 }}>
          Mobile upgrade opens the bKash checkout first. Pro is {MOBILE_PLAN_PRICES.pro} and Premium Plus is {MOBILE_PLAN_PRICES.premium}.
        </Text>
        <PrimaryButton
          label={upgradeLoading === 'pro' ? 'Opening Pro on bKash...' : 'Pay Pro with bKash'}
          onPress={() => openUpgrade('pro')}
          disabled={upgradeLoading !== null}
        />
        <SecondaryButton
          label={upgradeLoading === 'premium' ? 'Opening Premium Plus on bKash...' : 'Pay Premium Plus with bKash'}
          onPress={() => openUpgrade('premium')}
          disabled={upgradeLoading !== null}
        />
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>App status</Text>
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.mutedText }}>API base URL: {mobileEnv.apiBaseUrl}</Text>
          <Text style={{ color: colors.mutedText }}>
            Authenticated: {me?.authenticated ? 'Yes' : 'No'}
          </Text>
          <Text style={{ color: colors.mutedText }}>
            Onboarding complete: {profile?.onboardingCompleted ? 'Yes' : 'No'}
          </Text>
        </View>
        <SecondaryButton
          label={refreshing ? 'Refreshing...' : 'Refresh account state'}
          onPress={() => void refreshBootstrap()}
          disabled={refreshing}
        />
      </Card>

      <InlineError message={error || actionError} />

      <Card>
        <Text style={{ color: colors.mutedText, lineHeight: 22 }}>
          Need to switch accounts or recover a broken session? Sign out and sign back in to refresh
          all mobile auth state.
        </Text>
        <SecondaryButton
          label="Log out"
          onPress={() =>
            void signOut().catch((signOutError) =>
              setActionError(
                signOutError instanceof Error ? signOutError.message : 'Could not sign out.'
              )
            )
          }
        />
      </Card>
    </Screen>
  )
}
