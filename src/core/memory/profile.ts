/**
 * 用户档案管理
 */

import { db } from '@/lib/db';

export interface UserProfile {
    age?: number;
    gender?: string;
    allergies?: string;
    history?: string;
    notes?: string;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
    try {
        const profile = await db.userProfile.findUnique({
            where: { userId },
        });

        if (!profile) return null;

        return {
            age: profile.age || undefined,
            gender: profile.gender || undefined,
            allergies: profile.allergies || undefined,
            history: profile.history || undefined,
            notes: profile.notes || undefined,
        };
    } catch (e) {
        console.error('[ProfileManager] 获取档案失败:', e);
        return null;
    }
}

export async function updateProfile(userId: string, updates: UserProfile): Promise<void> {
    try {
        await db.userProfile.upsert({
            where: { userId },
            update: { ...updates },
            create: {
                userId,
                ...updates,
            },
        });
    } catch (e) {
        console.error('[ProfileManager] 更新档案失败:', e);
    }
}

export async function extractFromConversation(
    userId: string,
    messages: Array<{ role: string; content: string }>
): Promise<void> {
    const profile: UserProfile = {};

    for (const msg of messages) {
        if (msg.role !== 'user') continue;
        const text = msg.content;

        const ageMatch = text.match(/我今年(\d+)岁|我(\d+)岁|年龄(\d+)/);
        if (ageMatch) {
            profile.age = parseInt(ageMatch[1] || ageMatch[2] || ageMatch[3]);
        }

        if (text.includes('我是男的') || text.includes('我是男性')) {
            profile.gender = 'male';
        } else if (text.includes('我是女的') || text.includes('我是女性')) {
            profile.gender = 'female';
        }

        const allergyMatch = text.match(/我对(.+?)过敏/);
        if (allergyMatch) {
            profile.allergies = allergyMatch[1];
        }
    }

    if (Object.keys(profile).length > 0) {
        await updateProfile(userId, profile);
    }
}

export async function buildProfileContext(userId: string): Promise<string> {
    const profile = await getProfile(userId);
    if (!profile) return '';

    const parts: string[] = ['【用户档案】'];
    if (profile.age) parts.push(`年龄：${profile.age}岁`);
    if (profile.gender) parts.push(`性别：${profile.gender === 'male' ? '男' : '女'}`);
    if (profile.allergies) parts.push(`过敏史：${profile.allergies}`);
    if (profile.history) parts.push(`既往病史：${profile.history}`);

    return parts.join('\n');
}