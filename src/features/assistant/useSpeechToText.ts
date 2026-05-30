/**
 * Speech-to-text for the assistant composer, built on the browser's native
 * Web Speech API (SpeechRecognition). No API key or backend needed — the
 * recognition runs in the browser. Unsupported browsers (e.g. Firefox) report
 * `isSupported: false` so the caller can hide the mic button.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/** Minimal shape of the recognition object (not fully typed in lib.dom). */
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechResultEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed':
    'Microphone access is blocked. Allow it in your browser settings to use voice input.',
  'service-not-allowed':
    'Microphone access is blocked. Allow it in your browser settings to use voice input.',
  'audio-capture': 'No microphone was found. Check that one is connected and enabled.',
  network: 'Voice input lost its network connection. Check your connection and try again.',
}

export interface UseSpeechToTextOptions {
  /** Called with the full cumulative transcript (final + interim) of the session. */
  onResult: (transcript: string) => void
  /** Called with a friendly message when recognition fails. */
  onError?: (message: string) => void
  /** BCP-47 language tag, e.g. "en-US". Defaults to the browser language. */
  lang?: string
}

export interface UseSpeechToText {
  /** Whether the browser supports speech recognition at all. */
  isSupported: boolean
  /** Whether we are actively listening. */
  isListening: boolean
  start: () => void
  stop: () => void
}

export function useSpeechToText(options: UseSpeechToTextOptions): UseSpeechToText {
  const [isSupported] = useState(() => Boolean(getRecognitionCtor()))
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  // Keep the latest callbacks in refs so a long-lived recognition session always
  // calls the current closures without us having to re-create the recognizer.
  const onResultRef = useRef(options.onResult)
  const onErrorRef = useRef(options.onError)
  onResultRef.current = options.onResult
  onErrorRef.current = options.onError
  const { lang } = options

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* no-op */
    }
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    // Tear down any prior session first.
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        /* no-op */
      }
      recognitionRef.current = null
    }

    const recognition = new Ctor()
    recognition.lang =
      lang || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)
    recognition.onresult = event => {
      // results accumulate across the session; rebuild the full transcript.
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i]?.[0]?.transcript ?? ''
      }
      onResultRef.current(transcript.trim())
    }
    recognition.onerror = event => {
      // 'aborted' = we stopped it; 'no-speech' = a silent pause. Both benign.
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        onErrorRef.current?.(
          ERROR_MESSAGES[event.error] || 'Voice input ran into a problem. Try again.'
        )
      }
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      // start() throws if called twice in a row; ignore.
    }
  }, [lang])

  // Abort any in-flight session when the component unmounts.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        /* no-op */
      }
    }
  }, [])

  return { isSupported, isListening, start, stop }
}
