export class OutsideCoverageError extends Error {
  constructor(message = 'Il punto è fuori dall’area coperta.') {
    super(message);
    this.name = 'OutsideCoverageError';
  }
}

export class DataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataUnavailableError';
  }
}

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
