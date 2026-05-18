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

        const messages = await db.message.findMany({
            where: { sessionId: id },
            orderBy: { createdAt: 'asc' },
        });

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
            messages: messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                intent: m.intent,
                sources: m.sources,
                feedbackRating: m.feedbackRating,
                createdAt: m.createdAt.toISOString(),
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