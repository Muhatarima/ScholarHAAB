'use client'

import type { CSSProperties, FormEvent } from 'react'

export default function ChatInput({
  disabled,
  onAttach,
  onChange,
  onSubmit,
  value,
}: {
  disabled?: boolean
  onAttach?: () => void
  onChange: (value: string) => void
  onSubmit: () => void
  value: string
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={submit} style={styles.form}>
      <button type="button" onClick={onAttach} style={styles.attach} aria-label="Upload">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path d="M8.4 12.7l5.7-5.7a3.2 3.2 0 014.5 4.5l-7.1 7.1a4.7 4.7 0 01-6.6-6.6l7.7-7.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M10.3 14.6l5.4-5.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      </button>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Type anything..." style={styles.input} />
      <button type="submit" disabled={disabled} style={styles.send}>
        →
      </button>
    </form>
  )
}

const styles = {
  form: {
    alignItems: 'center',
    background: 'rgba(12,10,28,0.96)',
    border: '1px solid rgba(170,85,255,0.16)',
    borderRadius: 24,
    display: 'flex',
    gap: 8,
    padding: 9,
  } satisfies CSSProperties,
  attach: {
    background: 'transparent',
    border: 'none',
    borderRadius: 999,
    color: '#b975ff',
    cursor: 'pointer',
    display: 'grid',
    height: 38,
    placeItems: 'center',
    width: 38,
  } satisfies CSSProperties,
  input: {
    background: 'transparent',
    border: 'none',
    color: '#e8e8ff',
    flex: 1,
    fontSize: 15,
    minWidth: 0,
    outline: 'none',
    padding: '10px 2px',
  } satisfies CSSProperties,
  send: {
    background: 'linear-gradient(130deg,#7733cc,#aa55ff)',
    border: 'none',
    borderRadius: 999,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 18,
    fontWeight: 900,
    height: 40,
    width: 40,
  } satisfies CSSProperties,
}
