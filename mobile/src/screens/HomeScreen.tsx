import React from 'react'
import { Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import { Card, PrimaryButton, Screen, SecondaryButton } from '../components/UI'
import { getTierLabel } from '../lib/plans'
import { colors } from '../theme'
import type { MainTabParamList, RootStackParamList } from '../navigation/types'

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>()
  const { me, profile } = useAuth()

  return (
    <Screen
      title={`Assalamu alaikum${profile?.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}`}
      subtitle="Ask past-paper questions, shortlist scholarships, review documents, and keep your study context synced."
    >
      <Card>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Quick start</Text>
        <PrimaryButton
          label="Open QBank chat"
          onPress={() => navigation.navigate('Chat', { product: 'qbank' })}
        />
        <SecondaryButton
          label="Open Abroad chat"
          onPress={() => navigation.navigate('Chat', { product: 'abroad' })}
        />
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Current plan</Text>
        <Text style={{ color: colors.mutedText, lineHeight: 22 }}>
          Tier: {getTierLabel(me?.tier)}
          {'\n'}
          Preferred board: {profile?.preferredBoard ?? 'Not set'}
          {'\n'}
          Preferred level: {profile?.preferredLevel ?? 'Not set'}
        </Text>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Study momentum</Text>
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.mutedText }}>
            Current streak: {me?.studyProgress?.currentStreak ?? 0}
          </Text>
          <Text style={{ color: colors.mutedText }}>
            Completed sessions: {me?.studyProgress?.completedSessions ?? 0}
          </Text>
          <Text style={{ color: colors.mutedText }}>
            Strongest subject: {me?.studyProgress?.strongestSubject ?? 'Not enough data yet'}
          </Text>
        </View>
      </Card>
    </Screen>
  )
}
