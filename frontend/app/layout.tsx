import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XHS RAG - 小红书收藏知识库",
  description: "把小红书收藏变成可对话、可分类的知识库",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
