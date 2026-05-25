import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNetInfo } from '@react-native-community/netinfo'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import { Card, InlineError, LoadingState, PrimaryButton, Screen, SecondaryButton } from '../components/UI'
import { MessageBubble, UploadChips, UploadProgress } from '../components/ChatPieces'
import { apiFetch } from '../lib/api'
import {
  buildChatEndpoint,
  buildChatPayload,
  buildDisplayUserMessage,
  getDefaultMessages,
  getProductConfig,
  normalizeChatResponse,
  normalizeSessionDetail,
} from '../lib/chat'
import { mergeProfileIntoSessionContext, updateSessionContext } from '../lib/sessionContext'
import {
  capturePhoto,
  encodeUploads,
  pickDocuments,
  pickFromLibrary,
  type PendingUpload,
} from '../lib/uploads'
import { colors } from '../theme'
import {
  createEmptyProfile,
  createEmptySessionContext,
  type ChatMessage,
  type Product,
  type PromptMode,
  type SessionContext,
} from '../types'
import type { RootStackParamList } from '../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>

const MAX_FILES = 4
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

function mergeUploads(current: PendingUpload[], next: PendingUpload[]) {
  const merged = [...current]
  for (const upload of next) {
    if (upload.size && upload.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`${upload.name} exceeds the 10MB file limit.`)
    }

    const exists = merged.some(
      (entry) => entry.uri === upload.uri || (entry.name === upload.name && entry.size === upload.size)
    )
    if (!exists) {
      merged.push(upload)
    }
  }

  if (merged.length > MAX_FILES) {
    throw new Error('Attach up to 4 files at once.')
  }

  return merged
}

function buildInitialContext(product: Product, profile = createEmptyProfile()) {
  return mergeProfileIntoSessionContext(product, profile, createEmptySessionContext())
}

export function ChatScreen({ route, navigation }: Props) {
  const netInfo = useNetInfo()
  const { me, profile, session, refreshBootstrap } = useAuth()
  const [product, setProduct] = useState<Product>(
    route.params?.product ?? me?.defaultProduct ?? 'qbank'
  )
  const [mode, setMode] = useState<PromptMode>('direct')
  const [sessionId, setSessionId] = useState<string | null>(route.params?.sessionId ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>(getDefaultMessages(product))
  const [sessionContext, setSessionContext] = useState<SessionContext>(
    buildInitialContext(product, profile ?? createEmptyProfile())
  )
  const [input, setInput] = useState('')
  const [uploads, setUploads] = useState<PendingUpload[]>([])
  const [loadingSession, setLoadingSession] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [uploadLabel, setUploadLabel] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const listRef = useRef<FlatList<ChatMessage>>(null)

  const config = useMemo(() => getProductConfig(product), [product])
  const isOffline = netInfo.isConnected === false

  const resetConversation = useCallback(
    (nextProduct: Product) => {
      setProduct(nextProduct)
      setMode('direct')
      setSessionId(null)
      setMessages(getDefaultMessages(nextProduct))
      setSessionContext(buildInitialContext(nextProduct, profile ?? createEmptyProfile()))
      setUploads([])
      setInput('')
      setError(null)
      setComposerError(null)
      navigation.setParams({ product: nextProduct, sessionId: undefined })
    },
    [navigation, profile]
  )

  useEffect(() => {
    if (!profile) {
      return
    }

    setSessionContext((current) => mergeProfileIntoSessionContext(product, profile, current))
  }, [product, profile])

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true })
  }, [messages.length, sending])

  const loadSession = useCallback(async () => {
    const targetSessionId = route.params?.sessionId
    const targetProduct = route.params?.product ?? product

    if (!targetSessionId || !session?.access_token) {
      setProduct(targetProduct)
      setSessionId(null)
      setMessages(getDefaultMessages(targetProduct))
      setSessionContext(buildInitialContext(targetProduct, profile ?? createEmptyProfile()))
      return
    }

    setLoadingSession(true)
    setError(null)

    try {
      const payload = await apiFetch(`/api/history/${targetSessionId}`, {
        method: 'GET',
        accessToken: session.access_token,
      })
      const detail = normalizeSessionDetail(payload)

      const resolvedProduct = detail.session?.product ?? targetProduct
      const resolvedMode = detail.session?.mode ?? 'direct'

      setProduct(resolvedProduct)
      setMode(resolvedMode)
      setSessionId(targetSessionId)
      setMessages(detail.messages.length > 0 ? detail.messages : getDefaultMessages(resolvedProduct))
      setSessionContext(buildInitialContext(resolvedProduct, profile ?? createEmptyProfile()))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this chat.')
      setMessages(getDefaultMessages(targetProduct))
    } finally {
      setLoadingSession(false)
    }
  }, [product, profile, route.params?.product, route.params?.sessionId, session?.access_token])

  useFocusEffect(
    useCallback(() => {
      void loadSession()
    }, [loadSession])
  )

  const attachDocuments = async () => {
    try {
      setComposerError(null)
      const next = await pickDocuments()
      setUploads((current) => mergeUploads(current, next))
    } catch (attachError) {
      setComposerError(attachError instanceof Error ? attachError.message : 'Could not attach files.')
    }
  }

  const attachFromLibrary = async () => {
    try {
      setComposerError(null)
      const next = await pickFromLibrary()
      setUploads((current) => mergeUploads(current, next))
    } catch (attachError) {
      setComposerError(
        attachError instanceof Error ? attachError.message : 'Could not open your photo library.'
      )
    }
  }

  const attachFromCamera = async () => {
    try {
      setComposerError(null)
      const next = await capturePhoto()
      setUploads((current) => mergeUploads(current, next))
    } catch (attachError) {
      setComposerError(attachError instanceof Error ? attachError.message : 'Could not open camera.')
    }
  }

  const send = async () => {
    if (sending) {
      return
    }

    if (isOffline) {
      setError('You are offline. Reconnect and try again.')
      return
    }

    const trimmedInput = input.trim()
    if (!trimmedInput && uploads.length === 0) {
      setComposerError('Add a question or attach a file before sending.')
      return
    }

    if (!session?.access_token) {
      setError('Please sign in again to continue.')
      return
    }

    setSending(true)
    setError(null)
    setComposerError(null)

    try {
      setUploadLabel(uploads.length > 0 ? 'Preparing attachments...' : null)
      const encodedUploads =
        uploads.length > 0
          ? await encodeUploads(uploads, (current, total) => {
              setUploadProgress(`${current}/${total}`)
            })
          : []

      const endpoint = buildChatEndpoint(product, encodedUploads)
      const payload = buildChatPayload({
        message: trimmedInput,
        mode,
        sessionId,
        sessionContext,
        uploads: encodedUploads,
      })

      setUploadLabel(encodedUploads.length > 0 ? 'Sending to ScholarHAAB...' : null)
      setUploadProgress(null)

      const rawResponse = await apiFetch(endpoint, {
        method: 'POST',
        accessToken: session.access_token,
        body: JSON.stringify(payload),
      })
      const response = normalizeChatResponse(rawResponse)

      if (!response.response.trim()) {
        throw new Error('The assistant returned an empty response.')
      }

      const nextSessionId = response.sessionId ?? sessionId
      const nextUserMessage = buildDisplayUserMessage(trimmedInput, uploads)

      setMessages((current) => [
        ...current,
        {
          role: 'user',
          content: nextUserMessage,
        },
        {
          role: 'assistant',
          content: response.response,
          sources: response.sources,
        },
      ])
      setSessionContext((current) =>
        updateSessionContext(current, trimmedInput, response.response, product)
      )
      setInput('')
      setUploads([])
      setSessionId(nextSessionId)
      navigation.setParams({ product, sessionId: nextSessionId ?? undefined })
      await refreshBootstrap()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send your message.')
    } finally {
      setUploadLabel(null)
      setUploadProgress(null)
      setSending(false)
    }
  }

  return (
    <Screen title={config.title} subtitle={config.subtitle} scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Card>
          <View style={styles.productRow}>
            {(['qbank', 'abroad'] as const).map((entry) => {
              const active = entry === product
              return (
                <Pressable
                  key={entry}
                  style={[styles.productChip, active && styles.productChipActive]}
                  onPress={() => resetConversation(entry)}
                  disabled={sending || loadingSession}
                >
                  <Text style={[styles.productChipText, active && styles.productChipTextActive]}>
                    {entry === 'qbank' ? 'QBank' : 'Abroad'}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={styles.placeholderText}>{config.placeholder}</Text>

          {product === 'qbank' ? (
            <View style={styles.productRow}>
              {(['direct', 'tutor'] as const).map((entry) => {
                const active = entry === mode
                return (
                  <Pressable
                    key={entry}
                    style={[styles.modeChip, active && styles.productChipActive]}
                    onPress={() => setMode(entry)}
                    disabled={sending || loadingSession}
                  >
                    <Text style={[styles.productChipText, active && styles.productChipTextActive]}>
                      {entry === 'direct' ? 'Direct' : 'Tutor'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          <View style={styles.quickPromptRow}>
            {config.quickPrompts.slice(0, 2).map((prompt) => (
              <Pressable
                key={prompt}
                style={styles.quickPrompt}
                onPress={() => setInput(prompt)}
                disabled={sending}
              >
                <Text style={styles.quickPromptText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>

          {isOffline ? (
            <Text style={styles.offlineText}>Offline mode: reconnect to send questions.</Text>
          ) : null}
        </Card>

        {loadingSession ? <LoadingState label="Loading chat..." /> : null}
        <InlineError message={error} />

        <View style={styles.messagesWrap}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item, index) => item.id ?? `${item.role}-${index}`}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={styles.messageList}
          />
        </View>

        <Card>
          <View style={styles.attachRow}>
            <SecondaryButton label="Files" onPress={attachDocuments} disabled={sending} />
            <SecondaryButton label="Photos" onPress={attachFromLibrary} disabled={sending} />
            <SecondaryButton label="Camera" onPress={attachFromCamera} disabled={sending} />
          </View>

          <UploadChips
            uploads={uploads}
            onRemove={(index) => setUploads((current) => current.filter((_, entry) => entry !== index))}
          />
          <UploadProgress label={uploadLabel} progress={uploadProgress} />

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={config.placeholder}
            placeholderTextColor={colors.subtleText}
            multiline
            style={styles.composer}
          />

          <InlineError message={composerError} />

          <View style={styles.sendRow}>
            <Text style={styles.helperText}>
              {sessionId ? 'Continuing saved chat.' : 'A new chat will be created after your first message.'}
            </Text>
            <PrimaryButton
              label={sending ? 'Sending...' : 'Send'}
              onPress={send}
              disabled={sending || loadingSession}
            />
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 14,
  },
  productRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  productChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
  },
  productChipActive: {
    backgroundColor: 'rgba(107,228,255,0.15)',
    borderColor: 'rgba(107,228,255,0.32)',
  },
  productChipText: {
    color: colors.mutedText,
    fontWeight: '600',
  },
  productChipTextActive: {
    color: colors.text,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
  },
  placeholderText: {
    color: colors.mutedText,
    lineHeight: 21,
  },
  quickPromptRow: {
    gap: 8,
  },
  quickPrompt: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    padding: 12,
  },
  quickPromptText: {
    color: colors.text,
    lineHeight: 21,
  },
  offlineText: {
    color: '#ffb8c8',
    lineHeight: 20,
  },
  messagesWrap: {
    flex: 1,
    minHeight: 240,
  },
  messageList: {
    gap: 12,
    paddingBottom: 10,
  },
  attachRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  composer: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 22,
  },
  sendRow: {
    gap: 10,
  },
  helperText: {
    color: colors.subtleText,
    fontSize: 12,
  },
})
