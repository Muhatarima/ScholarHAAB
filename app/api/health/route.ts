import { NextResponse } from 'next/server'

export async function GET() {
  // Public health check: intentionally no requireAuth so deploy platforms can probe it.
  return NextResponse.json({
    status: 'ok',
    app: 'ScholarHAAB',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
}
