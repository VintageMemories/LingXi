import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Get total count and per-domain counts from the knowledge base
    const totalCount = await db.knowledgeEntry.count()

    const domainCounts = await db.knowledgeEntry.groupBy({
      by: ['domain'],
      _count: {
        domain: true,
      },
    })

    const byDomain: Record<string, number> = {}
    for (const item of domainCounts) {
      byDomain[item.domain] = item._count.domain
    }

    return NextResponse.json({
      total: totalCount,
      byDomain,
    })
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json(
      { total: 0, byDomain: {} },
      { status: 500 }
    )
  }
}
