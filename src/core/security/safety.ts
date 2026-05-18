/**
 * 安全过滤器
 */

import { DomainConfig } from '@/core/domain-config';

export interface SafetyResult {
    blocked: boolean;
    emergency: boolean;
    message: string;
    matchedTerm?: string;
}

export function checkSafety(
    query: string,
    domainConfig: DomainConfig
): SafetyResult {
    const { forbidden_terms, emergency_terms } = domainConfig.safety;

    for (const term of forbidden_terms) {
        if (query.includes(term)) {
            return {
                blocked: true,
                emergency: false,
                message: '您的输入包含不当内容，请重新提问。如需心理帮助，请拨打24小时心理援助热线：400-161-9995',
                matchedTerm: term,
            };
        }
    }

    for (const term of emergency_terms) {
        if (query.includes(term)) {
            return {
                blocked: false,
                emergency: true,
                message: domainConfig.prompts.emergency || '⚠️ 检测到紧急情况，请立即拨打120急救电话！',
                matchedTerm: term,
            };
        }
    }

    return {
        blocked: false,
        emergency: false,
        message: '',
    };
}

export function addDisclaimer(
    content: string,
    domainConfig: DomainConfig,
    isRagUseful: boolean
): string {
    const domainId = domainConfig.domain.id;

    let disclaimer = '';
    switch (domainId) {
        case 'medical':
            if (!isRagUseful) {
                disclaimer = '\n\n---\n⚠️ 温馨提示：以上回答基于通用医学知识，我的专业资料库中暂无直接相关内容。如有不适，建议您前往正规医院就诊，以医生诊断为准。';
            } else {
                disclaimer = '\n\n---\n⚠️ 以上内容仅供参考，不能替代专业医生的诊断和治疗建议。如有不适，请及时就医。';
            }
            break;
        case 'legal':
            disclaimer = '\n\n---\n⚠️ 以上内容仅供参考，不构成法律意见。重大法律决策请咨询专业律师。';
            break;
        case 'finance':
            disclaimer = '\n\n---\n⚠️ 以上内容仅供参考，不构成投资建议。投资有风险，决策需谨慎。';
            break;
        default:
            disclaimer = '\n\n---\n⚠️ 以上内容仅供参考，请以专业人士的建议为准。';
    }

    return content + disclaimer;
}