/**
 * 知识库管理 API
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));

    const where: Record<string, unknown> = {};
    if (domain && domain !== '全部') {
      where.domain = domain;
    }
    if (search) {
      where.title = { contains: search };
    }

    const [entries, total] = await Promise.all([
      db.knowledgeEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          domain: true,
          category: true,
          source: true,
          createdAt: true,
        },
      }),
      db.knowledgeEntry.count({ where }),
    ]);

    // Get counts per domain
    const domainCounts = await db.knowledgeEntry.groupBy({
      by: ['domain'],
      _count: { domain: true },
    });

    const countsByDomain: Record<string, number> = {};
    for (const dc of domainCounts) {
      countsByDomain[dc.domain] = dc._count.domain;
    }

    return Response.json({
      entries: entries.map((e) => ({
        id: e.id,
        title: e.title,
        domain: e.domain,
        category: e.category,
        source: e.source,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      countsByDomain,
    });
  } catch (error) {
    console.error('[Knowledge API] GET error:', error);
    return Response.json({ error: '获取知识库列表失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return Response.json({ error: '缺少id' }, { status: 400 });
    }

    await db.knowledgeEntry.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[Knowledge API] DELETE error:', error);
    return Response.json({ error: '删除知识条目失败' }, { status: 500 });
  }
}
