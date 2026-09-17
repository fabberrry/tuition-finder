import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function ok(data: unknown, status = 200) {
  return Response.json({ success: true, data }, { status })
}

export function fail(error: unknown) {
  if (error instanceof ZodError) return Response.json({ success: false, error: 'Validation failed', details: error.flatten() }, { status: 422 })
  if (error instanceof ApiError) return Response.json({ success: false, error: error.message }, { status: error.status })
  if (typeof error === 'object' && error && 'code' in error) {
    if (error.code === '23505') return Response.json({ success: false, error: 'Resource already exists' }, { status: 409 })
    if (error.code === '23503' || error.code === '23514' || error.code === '22P02') return Response.json({ success: false, error: 'Invalid or conflicting reference' }, { status: 422 })
  }
  console.error(error)
  return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
}

export async function body(request: Request) {
  const size = Number(request.headers.get('content-length') ?? 0)
  if (size > 65536) throw new ApiError(413, 'Request body too large')
  try { return await request.json() } catch { throw new ApiError(400, 'Invalid JSON body') }
}

export function uuid(value: string | undefined) {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, 'Invalid ID')
  return value
}
