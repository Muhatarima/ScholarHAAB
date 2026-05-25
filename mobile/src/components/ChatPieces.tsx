import React from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'
import type { PendingUpload } from '../lib/uploads'
import type { ChatMessage, SourceCitation } from '../types'

export function UploadChips({
  uploads,
  onRemove,
}: {
  uploads: PendingUpload[]
  onRemove: (index: number) => void
}) {
  if (uploads.length === 0) {
    return null
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.chipRow}>
        {uploads.map((upload, index) => (
          <View key={`${upload.name}-${index}`} style={styles.chip}>
            <Text numberOfLines={1} style={styles.chipText}>
              {upload.name}
            </Text>
            <Pressable onPress={() => onRemove(index)}>
              <Text style={styles.chipAction}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

export function UploadProgress({
  label,
  progress,
}: {
  label: string | null
  progress: string | null
}) {
  if (!label) {
    return null
  }

  return (
    <View style={styles.progressBox}>
      <Text style={styles.progressLabel}>{label}</Text>
      {progress ? <Text style={styles.progressValue}>{progress}</Text> : null}
    </View>
  )
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const user = message.role === 'user'
  return (
    <View style={[styles.messageBubble, user ? styles.userBubble : styles.assistantBubble]}>
      <Text style={[styles.messageText, user && styles.userText]}>{message.content}</Text>
      {!user && message.sources?.length ? <SourceList sources={message.sources} /> : null}
    </View>
  )
}

export function SourceList({ sources }: { sources: SourceCitation[] }) {
  return (
    <View style={styles.sourceList}>
      {sources.slice(0, 4).map((source, index) => (
        <Pressable
          key={`${source.title}-${index}`}
          onPress={() => {
            if (source.url) {
              void Linking.openURL(source.url)
            }
          }}
          disabled={!source.url}
          style={styles.sourceCard}
        >
          <Text style={styles.sourceTitle}>{source.title}</Text>
          <Text style={styles.sourceMeta}>
            {[source.label, source.verified ? 'Verified' : null, source.lastChecked ?? null]
              .filter(Boolean)
              .join(' • ')}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 260,
  },
  chipText: {
    color: colors.text,
    maxWidth: 180,
  },
  chipAction: {
    color: colors.accent,
    fontSize: 12,
  },
  progressBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    padding: 12,
  },
  progressLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  progressValue: {
    color: colors.mutedText,
  },
  messageBubble: {
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  userBubble: {
    backgroundColor: colors.primaryStrong,
    alignSelf: 'flex-end',
    maxWidth: '86%',
  },
  assistantBubble: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  messageText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#ffffff',
  },
  sourceList: {
    gap: 8,
  },
  sourceCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    padding: 10,
  },
  sourceTitle: {
    color: colors.text,
    fontWeight: '600',
  },
  sourceMeta: {
    color: colors.subtleText,
    fontSize: 12,
    marginTop: 4,
  },
})
