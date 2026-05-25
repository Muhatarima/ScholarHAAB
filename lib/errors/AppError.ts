export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode = 500,
    public code = 'INTERNAL_ERROR',
    public isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  UNAUTHORIZED: new AppError('Unauthorized', 401, 'UNAUTHORIZED'),
  RATE_LIMITED: new AppError('Too many requests', 429, 'RATE_LIMITED'),
  INVALID_INPUT: (message: string) => new AppError(message, 400, 'INVALID_INPUT'),
  NOT_FOUND: (message: string) => new AppError(message, 404, 'NOT_FOUND'),
  AI_FAILED: new AppError('AI service temporarily unavailable', 503, 'AI_FAILED'),
};

export function handleApiError(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  console.error('Unexpected error:', error);
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
