export function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function getAppUrl() {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || 'https://scholarhaaab.com')
}

export function normalizeBkashStatus(rawStatus: string | null | undefined) {
  const status = rawStatus?.trim().toLowerCase()
  if (!status) {
    return 'unknown'
  }

  if (['success', 'completed', 'valid', 'validated'].includes(status)) {
    return 'success'
  }

  if (['cancel', 'cancelled', 'canceled'].includes(status)) {
    return 'cancel'
  }

  if (['failure', 'failed', 'error'].includes(status)) {
    return 'failure'
  }

  return 'unknown'
}

export function buildBkashCallbackUrl(invoice: string, tier: string, appUrl = getAppUrl()) {
  const params = new URLSearchParams({ invoice, tier })
  return `${trimTrailingSlash(appUrl)}/api/payment/bkash/callback?${params.toString()}`
}
