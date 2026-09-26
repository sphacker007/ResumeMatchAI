import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "VENTORA — Private AI Business OS", description: "Private AI business operating system for decisions, operations, growth and finance." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
