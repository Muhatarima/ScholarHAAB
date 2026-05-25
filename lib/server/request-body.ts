export class InvalidJsonBodyError extends Error {
  constructor(message = 'Request body must be valid JSON') {
    super(message)
    this.name = 'InvalidJsonBodyError'
  }
}

// Force API routes to work with JSON objects so handlers can validate fields safely.
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json()

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new InvalidJsonBodyError('Request body must be a JSON object')
    }

    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) {
      throw error
    }

    if (error instanceof SyntaxError) {
      throw new InvalidJsonBodyError()
    }

    throw error
  }
}
