import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "River Agency | Central de Aprovação de Conteúdo",
  description:
    "Central de aprovação de conteúdo da River Agency: prévia de posts de feed, carrosséis, stories e reels para aprovação dos clientes.",
};

export default function AprovacaoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
