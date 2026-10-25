/** Every Platform response is wrapped in this envelope (see docs/06-backend-architecture.md). */
export interface AppResponse<T> {
  success: boolean;
  data?: T;
  error?: AppError;
}

export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** A failed API call, normalised so screens can switch on `code`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const NETWORK_ERROR = 'NETWORK_ERROR';
