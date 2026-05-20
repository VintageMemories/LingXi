/**
 * 单个会话 API - 获取会话详情和消息列表
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const session = await db.session.findUnique({
            where: { id },
        });

        if (!session) {
            return Response.json({ error: '会话不存在' }, { status: 404 });
        }

        const dbUrl = process.env.DATABASE_URL || '未设置';
        console.log(`[Sessions/[id]] DATABASE_URL = ${dbUrl}`);

        // 诊断：查询全部消息数
        const totalCount = await db.$queryRaw<[{ cnt: number }]>`SELECT COUNT(*) as cnt FROM Message`;
        console.log(`[Sessions/[id]] 全表消息总数: ${totalCount[0].cnt}`);

        // 使用原始 SQL 查询指定会话的消息
        const rawMessages = await db.$queryRaw<Array<{
            id: string; sessionId: string; role: string; content: string;
            intent: string | null; model: string | null; sources: string | null;
            feedbackRating: number | null; createdAt: Date;
        }>>`SELECT id, sessionId, role, content, intent, model, sources, feedbackRating, createdAt FROM Message WHERE sessionId = ${id} ORDER BY createdAt ASC`;
        console.log(`[Sessions/[id]] 原始查询到 ${rawMessages.length} 条消息`);

        const sessionData: Record<string, unknown> = {
            id: session.id,
            domain: session.domain,
            title: session.title,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
        };

        try {
            const result = await db.$queryRaw`SELECT tags FROM Session WHERE id = ${id}`;
            const rows = result as Array<{ tags: string | null }>;
            sessionData.tags = rows[0]?.tags ? JSON.parse(rows[0].tags) : [];
        } catch {
            sessionData.tags = [];
        }

        return Response.json({
            session: sessionData,
            messages: rawMessages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                intent: m.intent,
                sources: m.sources,
                feedbackRating: m.feedbackRating,
                createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
            })),
        });
    } catch (error) {
        console.error('[Session Detail API] GET error:', error);
        return Response.json({ error: '获取会话详情失败' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { title, tags } = body;

        const updateData: Record<string, unknown> = {};

        if (title !== undefined && title !== null) {
            if (typeof title !== 'string') {
                return Response.json({ error: 'title必须为字符串' }, { status: 400 });
            }
            updateData.title = title.trim() || null;
        }

        if (tags !== undefined && !Array.isArray(tags)) {
            return Response.json({ error: 'tags必须为数组' }, { status: 400 });
        }

        let updatedSession: Record<string, unknown> = {};

        try {
            const prismaUpdateData: Record<string, unknown> = { ...updateData };
            if (tags !== undefined) {
                prismaUpdateData.tags = tags.length > 0 ? JSON.stringify(tags) : null;
            }

            const session = await db.session.update({
                where: { id },
                data: prismaUpdateData,
            });
            updatedSession = { id: session.id, title: session.title, tags: tags || [] };
        } catch {
            if (Object.keys(updateData).length > 0) {
                const session = await db.session.update({ where: { id }, data: updateData });
                updatedSession = { id: session.id, title: session.title };
            }
            if (tags !== undefined) {
                const tagsValue = tags.length > 0 ? JSON.stringify(tags) : null;
                await db.$executeRaw`UPDATE Session SET tags = ${tagsValue}, updatedAt = CURRENT_TIMESTAMP WHERE id = ${id}`;
                updatedSession.tags = tags;
            }
        }

        return Response.json({ session: updatedSession });
    } catch (error) {
        console.error('[Session Detail API] PATCH error:', error);
        return Response.json({ error: '更新会话失败' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await db.message.deleteMany({ where: { sessionId: id } });
        await db.session.delete({ where: { id } });
        return Response.json({ success: true });
    } catch (error) {
        console.error('[Session Detail API] DELETE error:', error);
        return Response.json({ error: '删除会话失败' }, { status: 500 });
    }
}