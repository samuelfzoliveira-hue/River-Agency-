import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RIVER OS", template: "%s · RIVER OS" },
  description: "Sistema operacional interno da River Agency: clientes, contratos, produção e prazos em um só lugar.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Aplica o tema antes da hidratação para evitar "flash" de tema errado.
const themeScript = `try{var t=localStorage.getItem('river-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
