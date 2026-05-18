/**
 * 健康检查 API
 */

import { getCurrentDomainId } from '@/core/domain-config';

export async function GET() {
    return Response.json({
        status: 'healthy',
        current_domain: getCurrentDomainId(),
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
}