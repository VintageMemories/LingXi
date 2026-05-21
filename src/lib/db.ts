import path from 'path'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// 构建数据库文件的绝对路径，防止 Next.js 运行时工作目录变化导致找不到文件
function getDatabaseUrl(): string {
    // 如果环境变量已指定绝对路径或非默认相对路径，直接使用
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:./')) {
        return process.env.DATABASE_URL
    }
    // 默认：项目根目录/prisma/dev.db
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    return `file:${dbPath}`
}

export const db =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ['query'],
        datasourceUrl: getDatabaseUrl(),
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db