// Custom HttpError class to standardize operational errors across controllers and services
// WHY: Allows throwing typed HTTP errors from deep within service layers without passing response objects down.
export class HttpError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
