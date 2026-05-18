/**
 * 反馈收集器
 */

import { db } from '@/lib/db';

export async function addFeedback(params: {
    userId?: string;
    sessionId: string;
    messageId?: string;
    rating: number;
    comment?: string;
    query?: string;
    response?: string;
    intent?: string;
    domain?: string;
}): Promise<boolean> {
    try {
        await db.feedback.create({
            data: {
                userId: params.userId,
                sessionId: params.sessionId,
                messageId: params.messageId,
                rating: params.rating,
                comment: params.comment,
                query: params.query,
                response: params.response,
                intent: params.intent,
                domain: params.domain,
            },
        });
        return true;
    } catch (e) {
        console.error('[FeedbackCollector] 添加反馈失败:', e);
        return false;
    }
}

export async function getLowQualitySamples(domain?: string, limit: number = 20) {
    try {
        return await db.feedback.findMany({
            where: {
                rating: -1,
                ...(domain && { domain }),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    } catch (e) {
        console.error('[FeedbackCollector] 获取低质量样本失败:', e);
        return [];
    }
}

export async function getFeedbackStats(domain?: string) {
    try {
        const positive = await db.feedback.count({
            where: { rating: 1, ...(domain && { domain }) },
        });
        const negative = await db.feedback.count({
            where: { rating: -1, ...(domain && { domain }) },
        });

        return {
            positive,
            negative,
            total: positive + negative,
            satisfactionRate:
                positive + negative > 0
                    ? ((positive / (positive + negative)) * 100).toFixed(1) + '%'
                    : 'N/A',
        };
    } catch (e) {
        console.error('[FeedbackCollector] 获取统计失败:', e);
        return { positive: 0, negative: 0, total: 0, satisfactionRate: 'N/A' };
    }
}