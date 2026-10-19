// src/utils/errors.ts
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}
