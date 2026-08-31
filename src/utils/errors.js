export class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }

  toJSON() {
    return {
      success: false,
      error: { code: this.code, message: this.message }
    };
  }
}

export const ErrorCodes = {
  INVALID_PHONE_NUMBER: 'INVALID_PHONE_NUMBER',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ALREADY_ACTIVE: 'SESSION_ALREADY_ACTIVE',
  PAIRING_IN_PROGRESS: 'PAIRING_IN_PROGRESS',
  PAIRING_FAILED: 'PAIRING_FAILED',
  PAIRING_TIMEOUT: 'PAIRING_TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

export function toApiError(err) {
  if (err instanceof AppError) return err.toJSON();
  return {
    success: false,
    error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Something went wrong. Please try again.' }
  };
}
