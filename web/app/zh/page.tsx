import type { Metadata } from "next";
import { SiteHome } from "@/components/site-home";

export const metadata: Metadata = {
  title: "占住 — 偶尔，也该让手机安静下来",
  description: "你不必一直高效，偶尔，也该让手机安静下来。",
  alternates: { canonical: "/zh", languages: { en: "/", "zh-CN": "/zh" } },
};

export default function ChineseHome() {
  return <SiteHome locale="zh" />;
}
