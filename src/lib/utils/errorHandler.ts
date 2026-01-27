/**
 * Error handling utilities for user-friendly error messages
 */

import { AxiosError } from 'axios'

interface ApiErrorResponse {
  error?: {
    message?: string
    statusCode?: number
  }
  message?: string
}

/**
 * Convert Cognito error codes to user-friendly messages
 */
function getCognitoErrorMessage(errorMessage: string): string {
  const lowerMessage = errorMessage.toLowerCase()

  // Common Cognito error patterns
  if (lowerMessage.includes('notauthorizedexception') || lowerMessage.includes('incorrect username or password')) {
    return 'Incorrect email or password. Please check your credentials and try again.'
  }

  if (lowerMessage.includes('usernotfoundexception') || lowerMessage.includes('user does not exist')) {
    return 'No account found with this email address. Please check your email or sign up for a new account.'
  }

  if (lowerMessage.includes('usernotconfirmedexception') || lowerMessage.includes('user is not confirmed')) {
    return 'Your account has not been confirmed. Please check your email for a confirmation link.'
  }

  if (lowerMessage.includes('invalidpasswordexception') || lowerMessage.includes('invalid password')) {
    return 'Password does not meet security requirements. Must include uppercase, lowercase, number, and special character.'
  }

  if (lowerMessage.includes('invalidparameterexception')) {
    if (lowerMessage.includes('password')) {
      // Check for specific password requirement violations
      if (lowerMessage.includes('length') || lowerMessage.includes('too short')) {
        return 'Password must be at least 8 characters long.'
      }
      if (lowerMessage.includes('uppercase')) {
        return 'Password must contain at least one uppercase letter.'
      }
      if (lowerMessage.includes('lowercase')) {
        return 'Password must contain at least one lowercase letter.'
      }
      if (lowerMessage.includes('numeric') || lowerMessage.includes('number')) {
        return 'Password must contain at least one number.'
      }
      if (lowerMessage.includes('symbol') || lowerMessage.includes('special')) {
        return 'Password must contain at least one special character (!@#$%^&*).'
      }
      // Generic password requirement message
      return 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
    }
    return 'Invalid information provided. Please check your input and try again.'
  }

  if (lowerMessage.includes('userexistsexception') || lowerMessage.includes('user already exists')) {
    return 'An account with this email already exists. Please sign in instead.'
  }

  if (lowerMessage.includes('limitexceededexception') || lowerMessage.includes('attempt limit exceeded')) {
    return 'Too many login attempts. Please wait a few minutes and try again.'
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('timeout') || lowerMessage.includes('econnrefused')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.'
  }

  // Check for specific backend error messages
  if (lowerMessage.includes('not provisioned')) {
    return 'Your account is not set up yet. Please contact support for assistance.'
  }

  if (lowerMessage.includes('email and password required')) {
    return 'Please enter both your email and password.'
  }

  if (lowerMessage.includes('missing required fields')) {
    return 'Please fill in all required fields.'
  }

  // Return original message if no match found (might already be user-friendly)
  return errorMessage
}

/**
 * Extract user-friendly error message from axios error
 */
export function getErrorMessage(error: unknown, fallback: string = 'An unexpected error occurred. Please try again.'): string {
  // Handle axios errors
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<ApiErrorResponse>
    
    // Try to get message from response data
    if (axiosError.response?.data) {
      const data = axiosError.response.data
      
      // Check for error.message format (from backend)
      if (data.error?.message) {
        return getCognitoErrorMessage(data.error.message)
      }
      
      // Check for direct message property
      if (data.message) {
        return getCognitoErrorMessage(data.message)
      }
    }
    
    // Handle HTTP status codes
    const status = axiosError.response?.status
    if (status === 400) {
      return 'Invalid request. Please check your information and try again.'
    }
    if (status === 401) {
      return 'Your session has expired. Please sign in again.'
    }
    if (status === 403) {
      return 'You do not have permission to perform this action.'
    }
    if (status === 404) {
      return 'The requested resource was not found.'
    }
    if (status === 500) {
      return 'A server error occurred. Please try again later.'
    }
    if (status === 503) {
      return 'The service is temporarily unavailable. Please try again later.'
    }
    
    // Network errors
    if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
      return 'The request took too long. Please check your connection and try again.'
    }
    
    if (axiosError.message) {
      return getCognitoErrorMessage(axiosError.message)
    }
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    return getCognitoErrorMessage(error.message)
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return getCognitoErrorMessage(error)
  }
  
  return fallback
}
