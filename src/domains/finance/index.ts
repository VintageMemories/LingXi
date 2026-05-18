import type { DomainConfig } from '@/core/domain-config';

export const financeConfig: DomainConfig = {
    domain: {
        id: 'finance',
        name: '金小助',
        display_name: '金融理财助手',
        icon: '📈',
        theme: 'finance',
        description: '专业金融理财咨询',
    },
    retrieval: {
        strategy: 'hybrid',
        bm25_weight: 0.5,
        vector_weight: 0.5,
        top_k: 5,
        rrf_k: 60,
        sources: [
            { name: 'regulations', weight: 0.7, enabled: true },
            { name: 'products', weight: 0.3, enabled: true },
        ],
    },
    intents: [
        {
            id: 'investment',
            priority: 1,
            keywords: ['理财', '基金', '股票', '投资', '收益率'],
            tools: ['investment_advisor'],
            use_rag: true,
            subscription: 'rag',
            stream_tools: true,
        },
        {
            id: 'insurance',
            priority: 2,
            keywords: ['保险', '理赔', '投保', '险种'],
            tools: ['insurance_advisor'],
            use_rag: true,
            subscription: 'rag',
        },
        {
            id: 'greeting',
            priority: 7,
            keywords: ['你好', '谢谢', '再见', '你是谁'],
            skip_llm: true,
            subscription: 'free',
            use_rag: false,
        },
        {
            id: 'finance_query',
            priority: 9,
            keywords: [],
            use_rag: true,
            subscription: 'rag',
        },
        {
            id: 'out_of_scope',
            priority: 10,
            keywords: ['天气', '电影', '游戏'],
            skip_llm: true,
            subscription: 'free',
            use_rag: false,
        },
    ],
    tools: [
        { name: 'investment_advisor', class: 'InvestmentAdvisorTool', stream_support: true, description: '提供理财建议' },
        { name: 'insurance_advisor', class: 'InsuranceAdvisorTool', stream_support: false, description: '保险咨询' },
    ],
    safety: {
        forbidden_terms: ['洗钱', '非法集资', '内幕交易'],
        emergency_terms: [],
    },
    prompts: {
        system: '你是一位专业的金融理财助手「金小助」。你的职责是：\n1. 提供金融理财知识\n2. 分析投资风险\n3. 解读金融产品\n\n重要原则：\n- 始终提醒：AI回答仅供参考，不构成投资建议\n- 投资有风险，决策需谨慎',
        rag: '请基于以下金融参考资料回答用户的问题：\n\n参考资料：\n{context}\n\n用户问题：{query}',
        out_of_scope: '您的问题可能与金融理财无关。作为金融助手，我建议您咨询相关领域的专业人士。',
    },
    subscription: {
        free: { daily_limit: 50, intents: ['greeting', 'out_of_scope'] },
        rag: { daily_limit: 200, intents: ['investment', 'insurance', 'finance_query'] },
        agent: { daily_limit: -1, intents: [] },
    },
    welcome: {
        title: '欢迎使用金小助',
        subtitle: '专业金融理财助手，助您财富增值',
        suggestions: ['如何开始理财？', '基金定投怎么选？', '保险怎么买？', '风险管理怎么做？'],
    },
};