/**
 * 分享对话 API
 * POST: 创建分享记录
 */

import { db } from '@/lib/db'
import { nanoid } from 'nanoid'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId || typeof sessionId !== 'string') {
      return Response.json({ error: '缺少 sessionId' }, { status: 400 })
    }

    // Verify the session exists
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { messages: true },
    })

    if (!session) {
      return Response.json({ error: '会话不存在' }, { status: 404 })
    }

    // Generate a unique share code (8 chars for easy sharing)
    const shareCode = nanoid(8)

    // Set expiration to 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const id = nanoid(12)

    // Use raw SQL as fallback if Prisma client is cached without Share model
    try {
      const share = await db.share.create({
        data: {
          shareCode,
          sessionId,
          expiresAt,
        },
      })

      return Response.json({
        shareCode: share.shareCode,
        expiresAt: share.expiresAt,
        createdAt: share.createdAt,
      })
    } catch {
      // Fallback: use raw SQL if db.share is not available in cached client
      await db.$executeRaw`
        INSERT INTO Share (id, shareCode, sessionId, expiresAt, createdAt)
        VALUES (${id}, ${shareCode}, ${sessionId}, ${expiresAt.toISOString()}, ${new Date().toISOString()})
      `

      return Response.json({
        shareCode,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('Share creation error:', error)
    return Response.json({ error: '创建分享失败' }, { status: 500 })
  }
}
