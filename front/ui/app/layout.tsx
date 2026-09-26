import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "../styles/globals.css";
import { Providers } from "@/components/providers";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "OpenBox - Document Intelligence Platform",
  description: "Document ingestion, graph visualization, and RAG chat",
  icons: {
    icon: "/icon-openbox.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${poppins.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
