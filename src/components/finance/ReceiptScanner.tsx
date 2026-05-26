/**
 * components/finance/ReceiptScanner.tsx
 *
 * Camera or file-pick a receipt image → Claude claude-haiku-4-5 extracts the data →
 * user confirms → expense added to the Conscious Spending Plan.
 *
 * Requires ANTHROPIC_API_KEY set in Convex dashboard env vars.
 */

import { useRef, useState } from 'react'
import { useAction, useConvexAuth } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { MaterialIcon } from '../ui/MaterialIcon'
import type { FinancialState, CSPExpense, CSPBucket, ParsedReceipt } from '../../domain/financialTypes'

function createId(): string {
  return `csp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const BUCKET_LABELS: Record<CSPBucket, string> = {
  fixed: 'Fixed Costs',
  investment: 'Investments',
  savings: 'Savings Goals',
  guiltFree: 'Guilt-Free Spending',
}

interface ReceiptScannerProps {
  state: FinancialState
  onUpdate: (updater: (prev: FinancialState) => FinancialState) => void
  onClose?: () => void
}

type ScanState = 'idle' | 'captured' | 'parsing' | 'done' | 'error'

export function ReceiptScanner({ onUpdate, onClose }: ReceiptScannerProps) {
  const { isAuthenticated } = useConvexAuth()
  const parseReceipt = useAction(api.receiptParser.parseReceipt)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // Editable fields after parsing
  const [editLabel, setEditLabel] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editBucket, setEditBucket] = useState<CSPBucket>('guiltFree')

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file (JPEG, PNG, WEBP).')
      setScanState('error')
      return
    }

    // Read file as base64
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setImagePreview(dataUrl)
      setScanState('parsing')
      setErrorMsg('')

      // Strip the data:image/jpeg;base64, prefix
      const base64 = dataUrl.split(',')[1] ?? ''
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

      try {
        const result = await parseReceipt({ imageBase64: base64, mediaType })
        setParsed(result)
        setEditLabel(result.merchant ?? '')
        setEditAmount(result.total != null ? String(result.total) : '')
        setEditBucket(result.suggestedBucket ?? 'guiltFree')
        setScanState('done')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setErrorMsg(msg.includes('ANTHROPIC_API_KEY')
          ? 'ANTHROPIC_API_KEY not set in Convex env vars. See Convex Dashboard → Project Settings → Environment Variables.'
          : msg)
        setScanState('error')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAddToCSP = () => {
    const amount = parseFloat(editAmount)
    if (!editLabel.trim() || isNaN(amount) || amount <= 0) return

    const expense: CSPExpense = {
      id: createId(),
      label: editLabel.trim(),
      monthlyAmount: amount,
      bucket: editBucket,
      category: parsed?.category,
    }

    onUpdate((prev) => ({
      ...prev,
      csp: {
        monthlyNetIncome: prev.csp?.monthlyNetIncome ?? 0,
        expenses: [...(prev.csp?.expenses ?? []), expense],
      },
    }))

    setConfirmed(true)
  }

  const handleReset = () => {
    setScanState('idle')
    setImagePreview(null)
    setParsed(null)
    setErrorMsg('')
    setConfirmed(false)
    setEditLabel('')
    setEditAmount('')
    setEditBucket('guiltFree')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-5 text-center space-y-2">
        <MaterialIcon name="lock" className="text-share-onSurfaceVariant/40 text-[2rem]" />
        <p className="text-xs text-share-onSurfaceVariant">
          Sign in to use the receipt scanner. The image is processed securely via Claude on Convex servers — your API key never touches your browser.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MaterialIcon name="receipt_long" className="text-share-primary text-[1.3rem]" />
          <h3 className="text-sm font-semibold text-share-onBg">Receipt Scanner</h3>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-share-onSurfaceVariant/50 hover:text-share-onSurfaceVariant">
            <MaterialIcon name="close" className="text-[1rem]" />
          </button>
        )}
      </div>

      <p className="text-xs text-share-onSurfaceVariant leading-relaxed">
        Take a photo or upload a receipt. Claude will extract the merchant, amount, and suggest which spending bucket it belongs in.
      </p>

      {/* Idle state - capture buttons */}
      {scanState === 'idle' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'image/*'
                fileInputRef.current.capture = 'environment'
                fileInputRef.current.click()
              }
            }}
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-share-outlineVariant p-5 text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
          >
            <MaterialIcon name="photo_camera" className="text-[1.8rem]" />
            <span className="text-xs font-medium">Take photo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'image/*'
                fileInputRef.current.removeAttribute('capture')
                fileInputRef.current.click()
              }
            }}
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-share-outlineVariant p-5 text-share-onSurfaceVariant hover:border-share-primary/50 hover:text-share-primary transition-colors"
          >
            <MaterialIcon name="upload_file" className="text-[1.8rem]" />
            <span className="text-xs font-medium">Upload image</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      )}

      {/* Parsing state */}
      {scanState === 'parsing' && (
        <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-6 text-center space-y-3">
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Receipt preview"
              className="mx-auto max-h-48 rounded-lg object-contain border border-share-outlineVariant"
            />
          )}
          <div className="flex items-center justify-center gap-2 text-share-primary">
            <div className="h-4 w-4 border-2 border-share-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Claude is reading the receipt…</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {scanState === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <MaterialIcon name="error" className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400 leading-relaxed">{errorMsg || 'Failed to parse receipt.'}</p>
          </div>
          <button type="button" onClick={handleReset} className="text-xs text-share-primary hover:underline">
            Try again
          </button>
        </div>
      )}

      {/* Done state */}
      {scanState === 'done' && parsed && !confirmed && (
        <div className="space-y-4">
          {/* Image + parsed summary side by side */}
          <div className="flex gap-3">
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Receipt"
                className="h-32 w-24 rounded-lg object-cover border border-share-outlineVariant flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-3 space-y-1.5 text-xs">
              {parsed.merchant && (
                <div className="flex justify-between gap-2">
                  <span className="text-share-onSurfaceVariant">Merchant</span>
                  <span className="text-share-onBg font-medium truncate">{parsed.merchant}</span>
                </div>
              )}
              {parsed.date && (
                <div className="flex justify-between gap-2">
                  <span className="text-share-onSurfaceVariant">Date</span>
                  <span className="text-share-onBg">{parsed.date}</span>
                </div>
              )}
              {parsed.total != null && (
                <div className="flex justify-between gap-2">
                  <span className="text-share-onSurfaceVariant">Total</span>
                  <span className="text-share-onBg font-semibold">{parsed.currency} {parsed.total.toFixed(2)}</span>
                </div>
              )}
              {parsed.category && (
                <div className="flex justify-between gap-2">
                  <span className="text-share-onSurfaceVariant">Category</span>
                  <span className="text-share-onBg capitalize">{parsed.category}</span>
                </div>
              )}
              {parsed.items.length > 0 && (
                <details className="mt-1">
                  <summary className="text-share-onSurfaceVariant/60 cursor-pointer">
                    {parsed.items.length} line items
                  </summary>
                  <ul className="mt-1 space-y-0.5 pl-2">
                    {parsed.items.map((item, i) => (
                      <li key={i} className="flex justify-between gap-2 text-[10px] text-share-onSurfaceVariant/70">
                        <span className="truncate">{item.description}</span>
                        <span>€{item.amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>

          {/* Editable fields before adding to CSP */}
          <div className="rounded-xl border border-share-outlineVariant bg-share-surfaceContainerLow p-4 space-y-3">
            <p className="text-xs font-semibold text-share-onBg">Add to Spending Plan</p>
            <p className="text-[10px] text-share-onSurfaceVariant/60">Review and adjust before saving.</p>

            <div>
              <label className="block text-xs text-share-onSurfaceVariant mb-1">Expense label</label>
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-share-onSurfaceVariant mb-1">Monthly amount (€)</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-share-onSurfaceVariant">€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow py-2 pl-6 pr-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-share-onSurfaceVariant/50 mt-0.5">
                  Divide annual costs by 12
                </p>
              </div>
              <div>
                <label className="block text-xs text-share-onSurfaceVariant mb-1">Bucket</label>
                <select
                  value={editBucket}
                  onChange={(e) => setEditBucket(e.target.value as CSPBucket)}
                  className="w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-2 py-2 text-sm text-share-onBg focus:border-share-primary focus:outline-none"
                >
                  {(Object.entries(BUCKET_LABELS) as [CSPBucket, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddToCSP}
                disabled={!editLabel.trim() || !editAmount}
                className="rounded-lg border border-share-primary bg-share-primary/10 px-4 py-2 text-xs font-medium text-share-primary hover:bg-share-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add to Spending Plan
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-share-outlineVariant/40 px-4 py-2 text-xs text-share-onSurfaceVariant hover:text-share-onBg transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmed */}
      {confirmed && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
          <MaterialIcon name="check_circle" filled className="text-emerald-400 text-[1.3rem] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-emerald-400">Added to Spending Plan</p>
            <p className="text-[10px] text-share-onSurfaceVariant/70 mt-0.5">
              "{editLabel}" — €{editAmount}/month in {BUCKET_LABELS[editBucket]}
            </p>
          </div>
          <button type="button" onClick={handleReset} className="text-xs text-share-primary hover:underline flex-shrink-0">
            Scan another
          </button>
        </div>
      )}
    </div>
  )
}
