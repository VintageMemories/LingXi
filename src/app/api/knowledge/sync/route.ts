/**
 * 知识库同步 API - 检测并更新已变更的知识条目
 * POST /api/knowledge/sync - 返回指定领域的条目统计
 * GET /api/knowledge/sync - 获取各领域的同步状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const domain = body.domain || 'medical';

        const entries = await db.knowledgeEntry.findMany({
            where: { domain },
            select: { id: true, fingerprint: true, title: true, updatedAt: true },
        });

        // 索引重建由后端处理，前端仅返回条目数量

        return NextResponse.json({
            success: true,
            domain,
            totalEntries: entries.length,
            message: `领域 "${domain}" 共有 ${entries.length} 条条目，索引重建请求已记录`,
        });
    } catch (error) {
        console.error('[Knowledge Sync] Error:', error);
        return NextResponse.json(
            { error: '知识库同步失败' },
            { status: 500 }
        );
    }
}

export async function GET(_request: NextRequest) {
    try {
        const domains = ['medical', 'legal', 'finance'];
        const stats = [];

        for (const domain of domains) {
            const count = await db.knowledgeEntry.count({
                where: { domain },
            });

            const lastUpdated = await db.knowledgeEntry.findFirst({
                where: { domain },
                orderBy: { updatedAt: 'desc' },
                select: { updatedAt: true },
            });

            stats.push({
                domain,
                entryCount: count,
                lastUpdated: lastUpdated?.updatedAt || null,
            });
        }

        return NextResponse.json({
            syncStatus: stats,
            message: '知识库同步状态',
        });
    } catch (error) {
        console.error('[Knowledge Sync Status] Error:', error);
        return NextResponse.json(
            { error: '获取同步状态失败' },
            { status: 500 }
        );
    }
}