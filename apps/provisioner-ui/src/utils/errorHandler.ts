import { useCallback } from 'react';
import { useToast } from '../components/Toast';

interface ApiError {
  response?: {
    data?: {
      detail?: string;
      msg?: string;
      error?: string;
    };
    status?: number;
  };
  message?: string;
}

interface UserFriendlyError {
  title: string;
  message: string;
  suggestion?: string;
}

const ERROR_MESSAGES: Record<string, UserFriendlyError> = {
  UNIQUE_NAME: {
    title: 'Name already exists',
    message: 'A record with this name already exists.',
    suggestion: 'Try a different name or check if you need to edit the existing one.',
  },
  UNIQUE_CONSTRAINT: {
    title: 'Duplicate entry',
    message: 'This combination already exists in the system.',
    suggestion: 'Please use different values.',
  },
  FOREIGN_KEY: {
    title: 'Reference error',
    message: 'This record is linked to other data.',
    suggestion: 'Please try again or contact support if the issue persists.',
  },
  VALIDATION_ERROR: {
    title: 'Invalid data',
    message: 'The provided data is not valid.',
    suggestion: 'Please check all fields and try again.',
  },
  AUTH_ERROR: {
    title: 'Authentication failed',
    message: 'Your session has expired or is invalid.',
    suggestion: 'Please log in again.',
  },
  PERMISSION_DENIED: {
    title: 'Permission denied',
    message: 'You do not have permission to perform this action.',
    suggestion: 'Contact your administrator if you believe this is an error.',
  },
  NOT_FOUND: {
    title: 'Not found',
    message: 'The requested resource was not found.',
    suggestion: 'It may have been deleted or moved.',
  },
  SERVER_ERROR: {
    title: 'Server error',
    message: 'An error occurred on the server.',
    suggestion: 'Please try again later.',
  },
  RATE_LIMIT: {
    title: 'Too many requests',
    message: 'You have made too many requests.',
    suggestion: 'Please wait a moment and try again.',
  },
  NETWORK_ERROR: {
    title: 'Network error',
    message: 'Unable to connect to the server.',
    suggestion: 'Please check your internet connection and try again.',
  },
};

function parseErrorMessage(errorMsg: string): UserFriendlyError {
  const lowerMsg = errorMsg.toLowerCase();

  if (lowerMsg.includes("name") && lowerMsg.includes("already exists")) {
    const nameMatch = errorMsg.match(/Name\s*['"]?([a-zA-Z0-9_-]+)['"]?\s*already/);
    const existingName = nameMatch ? nameMatch[1] : null;

    if (existingName) {
      return {
        title: 'Name already exists',
        message: `The name "${existingName}" is already in use.`,
        suggestion: `Try a different name like "${existingName}-copy" or "new-${existingName}".`,
      };
    }
    return {
      title: 'Already exists',
      message: errorMsg,
      suggestion: 'Try a different name.',
    };
  }

  if (lowerMsg.includes('combination') && lowerMsg.includes('already exists')) {
    const prefixMatch = errorMsg.match(/Combination\s*['"]?([a-zA-Z0-9-]+)['"]?\s*already/);
    const prefix = prefixMatch ? prefixMatch[1] : null;

    if (prefix) {
      const parts = prefix.split('-');
      if (parts.length >= 2) {
        return {
          title: 'Combination already exists',
          message: `The combination "${prefix}" is already in use.`,
          suggestion: `Try different prefixes like "${parts[0]}-ALT" or "ALT-${parts.slice(-1)[0]}".`,
        };
      }
    }
    return {
      title: 'Combination already exists',
      message: errorMsg,
      suggestion: 'Try different prefixes for your typification.',
    };
  }

  if (lowerMsg.includes('ya existe') || lowerMsg.includes('already exists') || lowerMsg.includes('duplicate')) {
    const nameMatch = errorMsg.match(/['"]?([a-zA-Z0-9_-]+)['"]?/);
    const existingName = nameMatch ? nameMatch[1] : null;

    if (existingName) {
      return {
        title: 'Already exists',
        message: `The name "${existingName}" is already in use.`,
        suggestion: `Try a different name like "${existingName}-copy" or "new-${existingName}".`,
      };
    }
    return ERROR_MESSAGES.UNIQUE_NAME;
  }

  if (lowerMsg.includes('unique constraint') || lowerMsg.includes('unique')) {
    return ERROR_MESSAGES.UNIQUE_CONSTRAINT;
  }

  if (lowerMsg.includes('foreign key') || lowerMsg.includes('reference')) {
    return ERROR_MESSAGES.FOREIGN_KEY;
  }

  if (lowerMsg.includes('validation') || lowerMsg.includes('invalid')) {
    return ERROR_MESSAGES.VALIDATION_ERROR;
  }

  if (lowerMsg.includes('401') || lowerMsg.includes('unauthorized')) {
    return ERROR_MESSAGES.AUTH_ERROR;
  }

  if (lowerMsg.includes('403') || lowerMsg.includes('forbidden') || lowerMsg.includes('permission')) {
    return ERROR_MESSAGES.PERMISSION_DENIED;
  }

  if (lowerMsg.includes('404') || lowerMsg.includes('not found')) {
    return ERROR_MESSAGES.NOT_FOUND;
  }

  if (lowerMsg.includes('500') || lowerMsg.includes('server error')) {
    return ERROR_MESSAGES.SERVER_ERROR;
  }

  if (lowerMsg.includes('429') || lowerMsg.includes('rate limit') || lowerMsg.includes('too many')) {
    return ERROR_MESSAGES.RATE_LIMIT;
  }

  return {
    title: 'Error',
    message: errorMsg,
    suggestion: 'Please try again or contact support if the issue persists.',
  };
}

function getErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred';

  if (typeof error === 'string') return error;

  if (typeof error === 'object') {
    const apiError = error as ApiError;

    if (apiError.response?.data?.detail) {
      return apiError.response.data.detail;
    }
    if (apiError.response?.data?.msg) {
      return apiError.response.data.msg;
    }
    if (apiError.response?.data?.error) {
      return apiError.response.data.error;
    }
    if (apiError.message) {
      return apiError.message;
    }
    if (apiError.response?.status) {
      return `HTTP ${apiError.response.status}: Request failed`;
    }
  }

  return 'An unexpected error occurred';
}

function useApiErrorHandler() {
  const { error: showToast } = useToast();

  const handleError = useCallback((error: unknown): UserFriendlyError => {
    const rawMessage = getErrorMessage(error);
    const parsedError = parseErrorMessage(rawMessage);

    showToast(parsedError.title, [
      parsedError.message,
      parsedError.suggestion,
    ].filter(Boolean).join(' '));

    return parsedError;
  }, [showToast]);

  const handleFormError = useCallback((error: unknown): Record<string, string> => {
    const rawMessage = getErrorMessage(error);
    const parsedError = parseErrorMessage(rawMessage);

    showToast(parsedError.title, [
      parsedError.message,
      parsedError.suggestion,
    ].filter(Boolean).join(' '));

    return {
      _form: parsedError.message,
    };
  }, [showToast]);

  return { handleError, handleFormError, parseErrorMessage, getErrorMessage };
}

export { useApiErrorHandler, parseErrorMessage, getErrorMessage };
export type { UserFriendlyError, ApiError };
