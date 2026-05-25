import 'react-native-gesture-handler'
import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { AuthScreen } from './src/screens/AuthScreen'
import { ChatScreen } from './src/screens/ChatScreen'
import { HistoryScreen } from './src/screens/HistoryScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { OnboardingScreen } from './src/screens/OnboardingScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { mobileEnv } from './src/lib/env'
import type { MainTabParamList, RootStackParamList } from './src/navigation/types'
import { colors } from './src/theme'

void mobileEnv.apiBaseUrl

const Tab = createBottomTabNavigator<MainTabParamList>()
const Stack = createNativeStackNavigator<RootStackParamList>()

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.panel,
    border: colors.border,
    text: colors.text,
    primary: colors.accent,
  },
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.panel },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedText,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}

function BootstrapGate() {
  const { session, me, profile, loading, error } = useAuth()

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.centerText}>Preparing ScholarHAAB Mobile...</Text>
      </View>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  const onboardingDone = profile?.onboardingCompleted ?? me?.onboardingCompleted ?? false
  if (!onboardingDone) {
    return <OnboardingScreen />
  }

  return (
    <>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.panel },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              title: 'Chat',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <BootstrapGate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = {
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    paddingHorizontal: 24,
  },
  centerText: {
    color: colors.mutedText,
  },
  errorBanner: {
    backgroundColor: 'rgba(255,107,140,0.14)',
    borderBottomColor: 'rgba(255,107,140,0.28)',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: {
    color: '#ffb8c8',
    textAlign: 'center' as const,
  },
}
