import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
    try {
        const { code, userId } = await request.json()

        if (!code || !userId) {
            return Response.json({ error: '缺少参数' }, { status: 400 })
        }

        const activationCode = await db.activationCode.findUnique({
            where: { code },
        })

        if (!activationCode) {
            return Response.json({ error: '激活码无效' }, { status: 404 })
        }

        if (activationCode.usedBy) {
            return Response.json({ error: '激活码已被使用' }, { status: 409 })
        }

        // 更新用户 plan
        await db.user.update({
            where: { id: userId },
            data: { plan: activationCode.plan },
        })

        // 标记激活码已使用
        await db.activationCode.update({
            where: { id: activationCode.id },
            data: {
                usedBy: userId,
                usedAt: new Date(),
            },
        })

        return Response.json({
            success: true,
            plan: activationCode.plan,
            message: `激活成功，当前方案：${activationCode.plan === 'agent' ? 'Agent版' : 'Pro版'}`,
        })
    } catch (error) {
        console.error('[Activate API] 激活失败:', error)
        return Response.json({ error: '激活失败' }, { status: 500 })
    }
}