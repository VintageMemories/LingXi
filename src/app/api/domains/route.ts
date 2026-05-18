/**
 * 领域管理 API
 */

import { NextRequest } from 'next/server';
import { getAllDomains, getCurrentDomain, getCurrentDomainId, switchDomain, getDomainConfig } from '@/core/domain-config';

export async function GET() {
    const domains = getAllDomains();
    const currentId = getCurrentDomainId();

    return Response.json({
        domains,
        default: currentId,
        status: 'developing',
    });
}

export async function POST(request: NextRequest) {
    try {
        const { domain } = await request.json();

        if (!domain) {
            return Response.json({ error: '请指定领域' }, { status: 400 });
        }

        const success = switchDomain(domain);
        if (!success) {
            return Response.json({ error: '领域不存在' }, { status: 404 });
        }

        const config = getDomainConfig(domain);

        return Response.json({
            success: true,
            current_domain: domain,
            domain_info: {
                id: config?.domain.id,
                name: config?.domain.name,
                display_name: config?.domain.display_name,
                icon: config?.domain.icon,
            },
        });
    } catch (error) {
        return Response.json({ error: '切换领域失败' }, { status: 500 });
    }
}