import type { Metadata } from "next";
import "./globals.css";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: "Lock Your — Sometimes your phone just needs to be quiet",
    template: "%s · Lock Your",
  },
  description: "You don't always need to be productive. Sometimes your phone just needs to be quiet.",
  openGraph: {
    title: "Lock Your",
    description: "Sometimes your phone just needs to be quiet.",
    type: "website",
    images: [{ url: "/hero-focus-room.png", width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lock Your",
    description: "Sometimes your phone just needs to be quiet.",
    images: ["/hero-focus-room.png"],
  },
  alternates: {
    canonical: "/",
    languages: { en: "/", "zh-CN": "/zh" },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
