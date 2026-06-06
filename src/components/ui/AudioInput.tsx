/**
 * components/ui/AudioInput.tsx
 *
 * Voice-to-text button using the Web Speech API.
 * Renders a mic icon button. On click it starts speech recognition and
 * calls onTranscript(text) when the user stops speaking.
 * Returns null on browsers that don't support SpeechRecognition.
 *
 * Recording stops when:
 *   1. The user clicks the button again (manual stop), OR
 *   2. 15 seconds of silence pass after the first word is detected.
 */

import { useEffect, useRef, useState } from 'react'
import { MaterialIcon } from './MaterialIcon'

const SILENCE_TIMEOUT_MS = 15000

interface AudioInputProps {
  onTranscript: (text: string) => void
  /** BCP-47 language tag. Defaults to English; pass 'de-DE' for German. */
  lang?: string
  className?: string
  title?: string
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}
interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function AudioInput({ onTranscript, lang = 'en-US', className = '', title }: AudioInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accumulatedRef = useRef('')

  // Cleanup on unmount — stop any active recognition and clear pending timer
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      recognitionRef.current?.stop()
    }
  }, [])

  const SpeechRecognitionClass = getSpeechRecognition()
  if (!SpeechRecognitionClass) return null

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }

  function resetSilenceTimer(recognition: SpeechRecognitionInstance) {
    clearSilenceTimer()
    silenceTimerRef.current = setTimeout(() => recognition.stop(), SILENCE_TIMEOUT_MS)
  }

  const startRecording = () => {
    accumulatedRef.current = ''
    const recognition = new SpeechRecognitionClass()
    recognition.lang = lang
    recognition.continuous = true     // keep listening until manually stopped or silence timeout
    recognition.interimResults = false

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i]?.[0]?.transcript ?? ''
        if (text) {
          accumulatedRef.current = accumulatedRef.current
            ? `${accumulatedRef.current} ${text}`
            : text
        }
      }
      // Reset silence timer only after speech is detected — gives user time to start speaking
      resetSilenceTimer(recognition)
    }

    recognition.onerror = () => {
      clearSilenceTimer()
      setIsRecording(false)
    }

    recognition.onend = () => {
      clearSilenceTimer()
      const text = accumulatedRef.current.trim()
      if (text) onTranscript(text)
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    // Do NOT start silence timer here — wait until user actually speaks (onresult fires)
  }

  const stopRecording = () => {
    clearSilenceTimer()
    recognitionRef.current?.stop()
    // onend fires next and delivers the accumulated transcript
  }

  return (
    <button
      type="button"
      onClick={isRecording ? stopRecording : startRecording}
      title={title ?? (isRecording ? 'Stop recording' : 'Record voice input')}
      aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
      className={[
        'flex items-center justify-center rounded-full transition-all',
        isRecording
          ? 'bg-red-500/20 text-red-400 animate-pulse ring-2 ring-red-500/40'
          : 'bg-share-surfaceContainerHigh text-share-onSurfaceVariant hover:text-share-onBg hover:bg-share-surfaceContainer',
        'p-1.5',
        className,
      ].join(' ')}
    >
      <MaterialIcon
        name={isRecording ? 'stop_circle' : 'mic'}
        className="text-[1.1rem]"
      />
    </button>
  )
}

/** Wraps a textarea or input with an AudioInput button in the corner. */
interface AudioTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  lang?: string
  className?: string
  /** If true, transcript appends to existing content instead of replacing. */
  append?: boolean
}

export function AudioTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  lang = 'en-US',
  className = '',
  append = true,
}: AudioTextareaProps) {
  const handleTranscript = (text: string) => {
    if (append && value !== '') {
      onChange(`${value.trim()} ${text}`)
    } else {
      onChange(text)
    }
  }

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={[
          'w-full rounded-lg border border-share-outlineVariant/40 bg-share-surfaceContainerLow px-3 py-2.5 pr-10 text-sm',
          'text-share-onBg placeholder:text-share-onSurfaceVariant/40 resize-none',
          'focus:border-share-primary focus:outline-none focus:ring-1 focus:ring-share-primary/30',
          className,
        ].join(' ')}
      />
      <div className="absolute right-2 top-2">
        <AudioInput onTranscript={handleTranscript} lang={lang} />
      </div>
    </div>
  )
}
