'use client'

import { useEffect, useRef, useState } from 'react'
import type { Product } from '@/lib/products'

type AttachmentPickerProps = {
  product: Product
  selectedFiles: File[]
  onSelectFiles: (files: File[]) => void
  onRemoveFile: (index: number) => void
  onClearFiles: () => void
  disabled?: boolean
}

const DOCUMENT_ACCEPT = [
  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.csv',
  '.tsv',
  '.json',
  '.xlsx',
  '.xls',
  '.pptx',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',')

const PRODUCT_COPY: Record<
  Product,
  {
    imageTitle: string
    imageCopy: string
    docTitle: string
    docCopy: string
  }
> = {
  qbank: {
    imageTitle: 'Photos or diagrams',
    imageCopy: 'Use screenshots, graphs, circuits, or camera photos.',
    docTitle: 'PDFs or documents',
    docCopy: 'Upload papers, mark schemes, notes, tables, or study files.',
  },
  abroad: {
    imageTitle: 'Photos or diagrams',
    imageCopy: 'Use screenshots, graphs, circuits, or camera photos.',
    docTitle: 'PDFs or documents',
    docCopy: 'Upload papers, mark schemes, notes, tables, or study files.',
  },
}

function getAttachmentLabel(file: File) {
  if (file.type.startsWith('image/')) {
    return 'Image'
  }

  if (file.type === 'application/pdf') {
    return 'PDF'
  }

  if (file.type.includes('spreadsheet') || /\.xlsx?$/i.test(file.name)) {
    return 'Spreadsheet'
  }

  if (file.type.includes('presentation') || /\.pptx$/i.test(file.name)) {
    return 'Slides'
  }

  if (/\.txt$|\.md$|\.csv$|\.tsv$|\.json$/i.test(file.name)) {
    return 'Text file'
  }

  return 'Document'
}

export default function AttachmentPicker({
  product,
  selectedFiles,
  onSelectFiles,
  onRemoveFile,
  onClearFiles,
  disabled = false,
}: AttachmentPickerProps) {
  const copy = PRODUCT_COPY[product]
  const menuRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (selectedFiles.length === 0) {
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }

      if (documentInputRef.current) {
        documentInputRef.current.value = ''
      }
    }
  }, [selectedFiles])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {selectedFiles.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(170,85,255,0.16)',
            color: '#DCD6F7',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ color: '#F3E8FF', fontWeight: 600 }}>
              {selectedFiles.length === 1 ? '1 file ready' : `${selectedFiles.length} files ready`}
            </span>
            <button
              type="button"
              onClick={onClearFiles}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#E9D5FF',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Clear all
            </button>
          </div>
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
                <span style={{ color: '#F3E8FF', fontWeight: 600 }}>{getAttachmentLabel(file)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#E9D5FF',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div ref={menuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(event) => {
            setOpen(false)
            onSelectFiles(Array.from(event.target.files ?? []))
          }}
          style={{ display: 'none' }}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept={DOCUMENT_ACCEPT}
          multiple
          onChange={(event) => {
            setOpen(false)
            onSelectFiles(Array.from(event.target.files ?? []))
          }}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          aria-label="Attach"
          title="Attach"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '999px',
            border: '1px solid rgba(170,85,255,0.22)',
            background: 'rgba(255,255,255,0.04)',
            color: '#E9D5FF',
            cursor: disabled ? 'default' : 'pointer',
            flexShrink: 0,
            fontSize: '18px',
            fontWeight: 600,
            opacity: disabled ? 0.65 : 1,
          }}
        >
          +
        </button>

        {open ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 'calc(100% + 10px)',
              width: 'min(340px, 100vw - 48px)',
              display: 'grid',
              gap: '10px',
              padding: '12px',
              borderRadius: '20px',
              border: '1px solid rgba(170,85,255,0.18)',
              background: 'rgba(10,10,28,0.96)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.36)',
            }}
          >
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              style={{
                display: 'grid',
                gap: '4px',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: '16px',
                border: '1px solid rgba(170,85,255,0.16)',
                background: 'rgba(255,255,255,0.04)',
                color: '#E8E8FF',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 600 }}>{copy.imageTitle}</span>
              <span style={{ fontSize: '12px', color: '#9A9ABE' }}>{copy.imageCopy}</span>
            </button>

            <button
              type="button"
              onClick={() => documentInputRef.current?.click()}
              style={{
                display: 'grid',
                gap: '4px',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: '16px',
                border: '1px solid rgba(170,85,255,0.16)',
                background: 'rgba(255,255,255,0.04)',
                color: '#E8E8FF',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 600 }}>{copy.docTitle}</span>
              <span style={{ fontSize: '12px', color: '#9A9ABE' }}>{copy.docCopy}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
