import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "River Agency | Central de Aprovação de Conteúdo",
  description:
    "Central de aprovação de conteúdo da River Agency: prévia de posts de feed, carrosséis, stories e reels para aprovação dos clientes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
