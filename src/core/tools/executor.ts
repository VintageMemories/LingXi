/**
 * 工具执行器
 */

import { DomainConfig } from '@/core/domain-config';

export interface ToolResult {
    success: boolean;
    data: string;
    metadata?: Record<string, unknown>;
}

export abstract class BaseTool {
    name: string = '';
    description: string = '';
    streamSupport: boolean = false;

    abstract execute(query: string, context?: string): Promise<ToolResult>;

    async *executeStream(query: string, context?: string): AsyncGenerator<ToolResult> {
        yield await this.execute(query, context);
    }
}

export class SymptomCheckerTool extends BaseTool {
    name = 'symptom_checker';
    description = '分析症状，提供可能的病因和建议';
    streamSupport = true;

    async execute(query: string, context?: string): Promise<ToolResult> {
        return {
            success: true,
            data: context || `正在分析症状「${query}」，请稍候...`,
            metadata: { type: 'symptom_analysis' },
        };
    }
}

export class DrugQueryTool extends BaseTool {
    name = 'drug_query';
    description = '查询药品信息、适应症、用法、禁忌';
    streamSupport = true;

    async execute(query: string, context?: string): Promise<ToolResult> {
        return {
            success: true,
            data: context || `正在查询药品信息「${query}」...`,
            metadata: { type: 'drug_info' },
        };
    }
}

export class EmergencyDetectorTool extends BaseTool {
    name = 'emergency_detector';
    description = '检测紧急情况，触发120提醒';
    streamSupport = false;

    async execute(query: string): Promise<ToolResult> {
        return {
            success: true,
            data: '⚠️ 检测到紧急医疗情况！请立即拨打120急救电话！',
            metadata: { type: 'emergency', priority: 'high' },
        };
    }
}

export class AppointmentGuideTool extends BaseTool {
    name = 'appointment_guide';
    description = '根据症状推荐挂号科室';
    streamSupport = false;

    async execute(query: string): Promise<ToolResult> {
        return {
            success: true,
            data: `根据您的描述，建议您挂号咨询。`,
            metadata: { type: 'appointment' },
        };
    }
}

export class DepartmentAdvisorTool extends BaseTool {
    name = 'department_advisor';
    description = '介绍科室诊疗范围';
    streamSupport = false;

    async execute(query: string): Promise<ToolResult> {
        return {
            success: true,
            data: `正在查询科室信息...`,
            metadata: { type: 'department' },
        };
    }
}

export class CheckupInterpreterTool extends BaseTool {
    name = 'checkup_interpreter';
    description = '解读体检报告指标';
    streamSupport = false;

    async execute(query: string): Promise<ToolResult> {
        return {
            success: true,
            data: `正在解读体检报告...`,
            metadata: { type: 'checkup' },
        };
    }
}

const toolRegistry: Record<string, new () => BaseTool> = {
    SymptomCheckerTool,
    DrugQueryTool,
    EmergencyDetectorTool,
    AppointmentGuideTool,
    DepartmentAdvisorTool,
    CheckupInterpreterTool,
};

export class ToolExecutor {
    private tools: Map<string, BaseTool> = new Map();

    constructor(domainConfig: DomainConfig) {
        for (const toolConfig of domainConfig.tools) {
            const ToolClass = toolRegistry[toolConfig.class];
            if (ToolClass) {
                const tool = new ToolClass();
                this.tools.set(toolConfig.name, tool);
            }
        }
    }

    async execute(toolName: string, query: string, context?: string): Promise<ToolResult> {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return { success: false, data: `工具 ${toolName} 不存在` };
        }
        return tool.execute(query, context);
    }

    async *executeStream(toolName: string, query: string, context?: string): AsyncGenerator<ToolResult> {
        const tool = this.tools.get(toolName);
        if (!tool) {
            yield { success: false, data: `工具 ${toolName} 不存在` };
            return;
        }

        if (tool.streamSupport) {
            yield* tool.executeStream(query, context);
        } else {
            yield await tool.execute(query, context);
        }
    }

    getAvailableTools(): Array<{ name: string; description: string; streamSupport: boolean }> {
        return Array.from(this.tools.values()).map(t => ({
            name: t.name,
            description: t.description,
            streamSupport: t.streamSupport,
        }));
    }
}