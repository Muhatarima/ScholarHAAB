import React, { useCallback, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import { Card, LoadingState, Screen } from '../components/UI'
import { apiFetch } from '../lib/api'
import { normalizeHistorySessions } from '../lib/chat'
import { colors } from '../theme'
import type { ChatSessionSummary, Product } from '../types'
import type { MainTabParamList, RootStackParamList } from '../navigation/types'

type HistoryNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'History'>,
  NativeStackNavigationProp<RootStackParamList>
>

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function HistoryScreen() {
  const navigation = useNavigation<HistoryNavigation>()
  const { session } = useAuth()
  const [product, setProduct] = useState<Product>('qbank')
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    if (!session?.access_token) {
      setSessions([])
      return
    }

    setError(null)
    const data = await apiFetch(`/api/history?product=${product}`, {
      method: 'GET',
      accessToken: session.access_token,
    })
    setSessions(normalizeHistorySessions(data))
  }, [product, session?.access_token])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      void loadHistory()
        .catch((loadError) =>
          setError(loadError instanceof Error ? loadError.message : 'Could not load history.')
        )
        .finally(() => setLoading(false))
    }, [loadHistory])
  )

  const refresh = async () => {
    setRefreshing(true)
    try {
      await loadHistory()
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : 'Could not refresh history.'
      )
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Screen
      title="Recent chats"
      subtitle="Jump back into any conversation without losing the context."
    >
      <Card>
        <View style={styles.filterRow}>
          {(['qbank', 'abroad'] as const).map((entry) => (
            <Pressable
              key={entry}
              onPress={() => setProduct(entry)}
              style={[styles.filterChip, product === entry && styles.activeChip]}
            >
              <Text style={[styles.filterText, product === entry && styles.activeText]}>
                {entry === 'qbank' ? 'QBank' : 'Abroad'}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {loading ? <LoadingState label="Loading your chat history..." /> : null}
      {error ? (
        <Card>
          <Text style={{ color: '#ffb8c8' }}>{error}</Text>
        </Card>
      ) : null}

      {!loading ? (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
          }
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          ListEmptyComponent={
            <Card>
              <Text style={{ color: colors.mutedText }}>
                No saved chats yet. Start one from Home.
              </Text>
            </Card>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.sessionCard}
              onPress={() =>
                navigation.navigate('Chat', {
                  sessionId: item.id,
                  product: item.product,
                })
              }
            >
              <Text style={styles.sessionTitle}>{item.title}</Text>
              <Text style={styles.sessionMeta}>
                {item.product === 'qbank' ? 'QBank' : 'Abroad'} • {formatDate(item.updatedAt)}
              </Text>
              {item.lastMessagePreview ? (
                <Text numberOfLines={2} style={styles.sessionPreview}>
                  {item.lastMessagePreview}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeChip: {
    backgroundColor: 'rgba(107,228,255,0.15)',
    borderColor: 'rgba(107,228,255,0.32)',
  },
  filterText: {
    color: colors.mutedText,
    fontWeight: '600',
  },
  activeText: {
    color: colors.text,
  },
  sessionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: 16,
    gap: 8,
  },
  sessionTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  sessionMeta: {
    color: colors.subtleText,
    fontSize: 12,
  },
  sessionPreview: {
    color: colors.mutedText,
    lineHeight: 21,
  },
})
