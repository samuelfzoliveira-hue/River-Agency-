import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "River Agency | Diagnóstico de Perfil Instagram",
  description:
    "Cole o link de um perfil do Instagram e receba um diagnóstico completo de posicionamento, conteúdo, engajamento e estratégia — pela River Agency.",
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
