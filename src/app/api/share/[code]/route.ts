import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
    try {
        const { code } = await params
        const share = await db.share.findUnique({ where: { shareCode: code } })
        if (!share) return Response.json({ error: '分享不存在或已过期' }, { status: 404 })
        if (share.expiresAt && new Date() > share.expiresAt) return Response.json({ error: '分享已过期' }, { status: 410 })
        const session = await db.session.findUnique({ where: { id: share.sessionId }, include: { messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, intent: true, sources: true, createdAt: true } } } })
        if (!session) return Response.json({ error: '原始会话已删除' }, { status: 404 })
        return Response.json({ shareCode: share.shareCode, session: { title: session.title, domain: session.domain, createdAt: session.createdAt }, messages: session.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, intent: m.intent, sources: m.sources ? JSON.parse(m.sources) : null, createdAt: m.createdAt })), expiresAt: share.expiresAt })
    } catch (error) { console.error(error); return Response.json({ error: 'error' }, { status: 500 }) }
}