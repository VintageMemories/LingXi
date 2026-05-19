import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
    const { userId, tokenUsage } = await request.json()
    if (!userId) return Response.json({ error: '缺少 userId' }, { status: 400 })

    await db.user.update({
        where: { id: userId },
        data: {
            promptTokens: { increment: tokenUsage.promptTokens },
            completionTokens: { increment: tokenUsage.completionTokens },
            totalTokens: { increment: tokenUsage.totalTokens },
        },
    })

    return Response.json({ success: true })
}

export async function GET(request: NextRequest) {
    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) return Response.json({ error: '缺少 userId' }, { status: 400 })

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return Response.json({ error: '用户不存在' }, { status: 404 })

    return Response.json({
        tokenUsage: {
            promptTokens: user.promptTokens || 0,
            completionTokens: user.completionTokens || 0,
            totalTokens: user.totalTokens || 0,
        },
    })
}

export async function DELETE(request: NextRequest) {
    const { userId } = await request.json()
    if (!userId) return Response.json({ error: '缺少 userId' }, { status: 400 })

    await db.user.update({
        where: { id: userId },
        data: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    })

    return Response.json({ success: true })
}