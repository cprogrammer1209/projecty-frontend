import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';

import { ApiError, AppResponse, NETWORK_ERROR } from './api.types';

const GENERIC_MESSAGE = 'Something went wrong. Try again in a moment.';

/** Turns any HTTP failure into an {@link ApiError}. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) {
    return err;
  }
  if (err instanceof HttpErrorResponse) {
    const body = err.error as AppResponse<unknown> | null;
    if (body?.error?.code) {
      return new ApiError(err.status, body.error.code, body.error.message, body.error.details ?? {});
    }
    return new ApiError(err.status, err.status === 0 ? NETWORK_ERROR : 'HTTP_' + err.status, GENERIC_MESSAGE);
  }
  return new ApiError(0, NETWORK_ERROR, GENERIC_MESSAGE);
}

/** Unwraps `AppResponse.data` and maps errors to {@link ApiError}. */
export function unwrap<T>() {
  return (source: Observable<AppResponse<T>>): Observable<T> =>
    source.pipe(
      map((res) => res.data as T),
      catchError((err) => throwError(() => toApiError(err))),
    );
}
