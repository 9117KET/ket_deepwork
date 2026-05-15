/**
 * components/ui/AudioInput.tsx
 *
 * Voice-to-text button using the Web Speech API.
 * Renders a mic icon button. On click it starts speech recognition and
 * calls onTranscript(text) when the user stops speaking.
 * Returns null on browsers that don't support SpeechRecognition.
 */

import { useRef, useState } from 'react'
import { MaterialIcon } from './MaterialIcon'

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
}
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
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
  const SpeechRecognitionClass = getSpeechRecognition()

  if (!SpeechRecognitionClass) return null

  const startRecording = () => {
    const recognition = new SpeechRecognitionClass()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      if (transcript) onTranscript(transcript)
      setIsRecording(false)
    }
    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => setIsRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
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
    if (append && value.trim()) {
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
          'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 pr-10 text-sm',
          'text-slate-100 placeholder:text-slate-600 resize-none',
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
