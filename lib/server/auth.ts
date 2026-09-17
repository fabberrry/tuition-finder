import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'
import { one } from './db'
import { ApiError, body, ok } from './http'

export type Role = 'student' | 'parent' | 'owner' | 'teacher' | 'admin'
export type User = { id: string; full_name: string; email: string; phone: string | null; role: Role; status: string }
const registration = z.object({ fullName: z.string().trim().min(2).max(150), email: z.email().transform(v => v.toLowerCase()), phone: z.string().trim().min(7).max(20).optional(), password: z.string().min(10).max(128), role: z.enum(['student','parent','owner','teacher']) }).strict()
const loginInput = z.object({ email: z.email(), password: z.string().min(1) }).strict()

function secret() {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be at least 32 characters')
  return new TextEncoder().encode(value)
}

async function token(user: User) {
  return new SignJWT({ role: user.role }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime('7d').sign(secret())
}

function sessionResponse(user: User, jwt: string) {
  const response = Response.json({ success: true, data: { user, token: jwt } })
  response.headers.append('Set-Cookie', `tuition_session=${jwt}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  return response
}

export async function register(request: Request) {
  const input = registration.parse(await body(request))
  const hash = await bcrypt.hash(input.password, 12)
  const user = await one<User>('INSERT INTO users (full_name,email,phone,password_hash,role) VALUES ($1,$2,$3,$4,$5) RETURNING id,full_name,email,phone,role,status', [input.fullName,input.email,input.phone ?? null,hash,input.role])
  return sessionResponse(user!, await token(user!))
}

export async function login(request: Request) {
  const input = loginInput.parse(await body(request))
  const record = await one<User & { password_hash: string }>('SELECT id,full_name,email,phone,role,status,password_hash FROM users WHERE email=$1', [input.email.toLowerCase()])
  if (!record || record.status !== 'active' || !await bcrypt.compare(input.password, record.password_hash)) throw new ApiError(401, 'Invalid credentials')
  const user: User = { id:record.id,full_name:record.full_name,email:record.email,phone:record.phone,role:record.role,status:record.status }
  return sessionResponse(user, await token(user))
}

export async function currentUser(request: Request): Promise<User> {
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('tuition_session='))?.slice(16)
  const jwt = bearer ?? cookie
  if (!jwt) throw new ApiError(401, 'Authentication required')
  if (!bearer && !['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin')
    if (!origin || origin !== new URL(request.url).origin) throw new ApiError(403, 'Invalid request origin')
  }
  let id: string
  try { id = (await jwtVerify(jwt, secret())).payload.sub! } catch { throw new ApiError(401, 'Invalid session') }
  const user = await one<User>('SELECT id,full_name,email,phone,role,status FROM users WHERE id=$1', [id])
  if (!user || user.status !== 'active') throw new ApiError(401, 'Invalid session')
  return user
}

export async function requireRole(request: Request, allowed: Role[]) {
  const user = await currentUser(request)
  if (!allowed.includes(user.role)) throw new ApiError(403, 'Insufficient permissions')
  return user
}

export function requireStudentActor(request: Request) {
  return requireRole(request, ['student', 'parent'])
}

export async function me(request: Request) { return ok(await currentUser(request)) }
export function logout() {
  const response = ok({ loggedOut: true })
  response.headers.append('Set-Cookie', 'tuition_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax')
  return response
}
