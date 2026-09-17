import { handle } from '@/lib/server/api'

export const runtime = 'nodejs'

type Context = { params: Promise<{ path: string[] }> }
const dispatch = async (request: Request, context: Context) => handle(request, (await context.params).path)

export { dispatch as GET, dispatch as POST, dispatch as PUT, dispatch as PATCH, dispatch as DELETE }
