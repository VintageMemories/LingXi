/**
 * 反馈 API
 * 收集用户对AI回答的满意度反馈
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { session_id, message_id, rating, comment, query, response, intent, domain } = body;

        if (!session_id || !rating || ![1, -1].includes(rating)) {
            return Response.json({ error: '缺少必要参数或评分无效' }, { status: 400 });
        }

        const feedback = await db.feedback.create({
            data: {
                sessionId: session_id,
                messageId: message_id || null,
                rating,
                comment: comment || null,
                query: query || null,
                response: response || null,
                intent: intent || null,
                domain: domain || null,
            },
        });

        return Response.json({ success: true, id: feedback.id });
    } catch (error) {
        console.error('[Feedback API] 提交反馈失败:', error);
        return Response.json({ error: '提交反馈失败' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const domain = url.searchParams.get('domain') || undefined;

        const where: Record<string, unknown> = {};
        if (domain) where.domain = domain;

        const [total, positive, negative] = await Promise.all([
            db.feedback.count({ where }),
            db.feedback.count({ where: { ...where, rating: 1 } }),
            db.feedback.count({ where: { ...where, rating: -1 } }),
        ]);

        return Response.json({
            total,
            positive,
            negative,
            satisfaction_rate: total > 0 ? Math.round((positive / total) * 1000) / 10 : 0,
        });
    } catch (error) {
        console.error('[Feedback API] 获取统计失败:', error);
        return Response.json({ error: '获取反馈统计失败' }, { status: 500 });
    }
}