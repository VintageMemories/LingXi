import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n/provider";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "灵析 - 领域通用智能体框架",
    description: "灵析：面向医疗、法律、金融等领域的智能对话助手，基于RAG+Agent架构，提供专业可靠的AI咨询服务。",
    keywords: ["灵析", "Lingxi", "AI助手", "医疗AI", "法律AI", "金融AI", "智能体", "Agent"],
    authors: [{ name: "灵析团队" }],
    icons: {
        icon: "/lingxi-logo.png",
    },
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
        <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        >
        <I18nProvider>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange={false}
            >
                <TooltipProvider delayDuration={300}>
                    {children}
                </TooltipProvider>
                <Toaster />
            </ThemeProvider>
        </I18nProvider>
        </body>
        </html>
    );
}