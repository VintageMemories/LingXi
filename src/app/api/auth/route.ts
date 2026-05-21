/**
 * 认证 API — Proxy 到后端 FastAPI
 */
import { NextRequest } from 'next/server';

const BACKEND_AUTH_URL = 'http://127.0.0.1:8000/api/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const res = await fetch(BACKEND_AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
            return Response.json(
                { error: data.detail || '认证失败' },
                { status: res.status }
            );
        }
        return Response.json(data);
    } catch (error) {
        console.error('[Auth Proxy] 认证失败:', error);
        return Response.json({ error: '认证失败' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('user_id');
        if (!userId) {
            return Response.json({ error: '未提供用户ID' }, { status: 401 });
        }
        const res = await fetch(`${BACKEND_AUTH_URL}?user_id=${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (!res.ok) {
            return Response.json(
                { error: data.detail || '获取用户信息失败' },
                { status: res.status }
            );
        }
        return Response.json(data);
    } catch (error) {
        return Response.json({ error: '获取用户信息失败' }, { status: 500 });
    }
}