import { forwardRef, useState, useEffect } from 'react'
import { formatPhoneNumber } from '@/lib/utils/phone'
import Input, { InputProps } from './Input'

export interface PhoneInputProps extends Omit<InputProps, 'onChange' | 'value' | 'type'> {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(value || '')

    // Update display value when external value changes
    useEffect(() => {
      if (value !== undefined) {
        setDisplayValue(value)
      }
    }, [value])

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
      onBlur?.(e)
    }

    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    )
  }
)

PhoneInput.displayName = 'PhoneInput'

export default PhoneInput
