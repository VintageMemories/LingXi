/**
 * 认证 API
 * 简易JWT认证系统
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

// 简易JWT（生产环境应使用专业库）
function createToken(payload: { userId: string; email: string }): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 86400000 })).toString('base64');
    const signature = Buffer.from(`${header}.${data}.${process.env.JWT_SECRET || 'lingxi-secret-key'}`).toString('base64');
    return `${header}.${data}.${signature}`;
}

// 注册
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'register') {
            const { email, password, name } = body;
            if (!email || !password) {
                return Response.json({ error: '邮箱和密码不能为空' }, { status: 400 });
            }

            // 检查是否已存在
            const existing = await db.user.findUnique({ where: { email } });
            if (existing) {
                return Response.json({ error: '邮箱已注册' }, { status: 409 });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const user = await db.user.create({
                data: {
                    email,
                    passwordHash,
                    name: name || email.split('@')[0],
                    plan: 'free',
                },
            });

            const token = createToken({ userId: user.id, email: user.email });

            return Response.json({
                success: true,
                user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
                token,
            });
        }

        if (action === 'login') {
            const { email, password } = body;
            if (!email || !password) {
                return Response.json({ error: '邮箱和密码不能为空' }, { status: 400 });
            }

            const user = await db.user.findUnique({ where: { email } });
            if (!user) {
                return Response.json({ error: '用户不存在' }, { status: 404 });
            }

            const valid = await bcrypt.compare(password, user.passwordHash);
            if (!valid) {
                return Response.json({ error: '密码错误' }, { status: 401 });
            }

            const token = createToken({ userId: user.id, email: user.email });

            return Response.json({
                success: true,
                user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
                token,
            });
        }

        return Response.json({ error: '未知操作' }, { status: 400 });
    } catch (error) {
        console.error('[Auth API] 认证失败:', error);
        return Response.json({ error: '认证失败' }, { status: 500 });
    }
}

// 获取当前用户信息
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('user_id');

        if (!userId) {
            return Response.json({ error: '未提供用户ID' }, { status: 401 });
        }

        const user = await db.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });

        if (!user) {
            return Response.json({ error: '用户不存在' }, { status: 404 });
        }

        return Response.json({
            id: user.id,
            email: user.email,
            name: user.name,
            plan: user.plan,
            dailyUsage: user.dailyUsage,
            profile: user.profile ? {
                age: user.profile.age,
                gender: user.profile.gender,
                allergies: user.profile.allergies,
                history: user.profile.history,
            } : null,
        });
    } catch (error) {
        return Response.json({ error: '获取用户信息失败' }, { status: 500 });
    }
}