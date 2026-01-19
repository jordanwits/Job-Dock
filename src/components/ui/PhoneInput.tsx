import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatPhoneNumber } from '@/lib/utils/phone'
import Input, { InputProps } from './Input'

export interface PhoneInputProps extends Omit<InputProps, 'onChange' | 'value' | 'type'> {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, onBlur, onFocus, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(value || '')
    const internalRef = useRef<HTMLInputElement | null>(null)

    const setRefs = useMemo(() => {
      return (node: HTMLInputElement | null) => {
        internalRef.current = node

        if (!ref) return
        if (typeof ref === 'function') {
          ref(node)
        } else {
          ;(ref as React.MutableRefObject<HTMLInputElement | null>).current = node
        }
      }
    }, [ref])

    const emitChange = (nextValue: string) => {
      if (!onChange) return

      const node = internalRef.current
      const name = (props as any).name

      // Prefer using the real input element as the event target so react-hook-form
      // can reliably read the value (Chrome autofill often bypasses React events).
      if (node) {
        node.value = nextValue
        
        // Dispatch native events to trigger immediate validation in react-hook-form
        const nativeInputEvent = new Event('input', { bubbles: true })
        const nativeChangeEvent = new Event('change', { bubbles: true })
        node.dispatchEvent(nativeInputEvent)
        node.dispatchEvent(nativeChangeEvent)
        
        const syntheticEvent = {
          target: node,
          currentTarget: node,
          type: 'change',
        } as unknown as React.ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
        return
      }

      // Fallback (should be rare): no node yet.
      onChange(
        {
          target: { value: nextValue, name },
          currentTarget: { value: nextValue, name },
          type: 'change',
        } as unknown as React.ChangeEvent<HTMLInputElement>
      )
    }

    const syncFromDom = useCallback(() => {
      const node = internalRef.current
      if (!node) return

      const raw = node.value
      if (!raw) return

      const formatted = formatPhoneNumber(raw)
      if (formatted === displayValue) return

      setDisplayValue(formatted)
      emitChange(formatted)
    }, [displayValue, emitChange])

    // Update display value when external value changes
    useEffect(() => {
      if (value !== undefined) {
        setDisplayValue(value)
      }
    }, [value])

    // Sync browser autofill (which may not fire onChange) into react-hook-form.
    // Without this, the field can *look* filled but still fail validation until the user types.
    useEffect(() => {
      // Autofill timing varies; also, the user can trigger it later (after focus).
      // We run a short-lived poll to catch late autofill without keeping a permanent interval.
      const timeouts = [0, 50, 200, 500, 1000].map((ms) => window.setTimeout(syncFromDom, ms))

      const startedAt = Date.now()
      const interval = window.setInterval(() => {
        syncFromDom()
        if (Date.now() - startedAt > 5000) {
          window.clearInterval(interval)
        }
      }, 250)

      return () => {
        timeouts.forEach((t) => window.clearTimeout(t))
        window.clearInterval(interval)
      }
    }, [syncFromDom])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      const formatted = formatPhoneNumber(inputValue)
      setDisplayValue(formatted)
      
      // Create a synthetic event with the formatted value for react-hook-form
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: formatted,
        },
        currentTarget: {
          ...e.currentTarget,
          value: formatted,
        },
      } as React.ChangeEvent<HTMLInputElement>
      
      onChange?.(syntheticEvent)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      syncFromDom()
      onBlur?.(e)
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Chrome often applies autofill on focus/selection without emitting input events.
      syncFromDom()
      onFocus?.(e)
    }

    const handleAnimationStart = (e: React.AnimationEvent<HTMLInputElement>) => {
      if (e.animationName === 'jd-autofill-start') {
        syncFromDom()
      }
    }

    return (
      <Input
        {...props}
        ref={setRefs}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onAnimationStart={handleAnimationStart}
      />
    )
  }
)

PhoneInput.displayName = 'PhoneInput'

export default PhoneInput
