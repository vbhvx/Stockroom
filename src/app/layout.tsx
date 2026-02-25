import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stockroom | E-Commerce Operations & Inventory SaaS",
  description: "Secure, auditable e-commerce operations, inventory control, and fulfillment platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-teal-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}

