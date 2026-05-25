import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../theme'

export function Screen({
  title,
  subtitle,
  scroll = true,
  children,
}: {
  title?: string
  subtitle?: string
  scroll?: boolean
  children: React.ReactNode
}) {
  const content = (
    <View style={styles.screenInner}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scrollContent}>{content}</ScrollView> : content}
    </SafeAreaView>
  )
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primaryButton, disabled && styles.disabledButton]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  )
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.secondaryButton, disabled && styles.disabledButton]}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  )
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  keyboardType,
  autoCapitalize = 'sentences',
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  multiline?: boolean
  keyboardType?: 'default' | 'email-address' | 'numeric'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtleText}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  )
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) {
    return null
  }

  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 18,
  },
  screenInner: {
    flex: 1,
    padding: 18,
    gap: 16,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 22,
    marginTop: -6,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primaryStrong,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: colors.panelSoft,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.mutedText,
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.55,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.mutedText,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  errorBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,140,0.35)',
    backgroundColor: 'rgba(255,107,140,0.10)',
    padding: 12,
  },
  errorText: {
    color: '#ffb8c8',
    lineHeight: 20,
  },
  loadingBox: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    color: colors.mutedText,
  },
})
