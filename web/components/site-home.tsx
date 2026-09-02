import { ArrowDown, ArrowUpRight, LockKeyhole, Volume2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LiveDashboard } from "./live-dashboard";

type Locale = "en" | "zh";

const content = {
  en: {
    lang: "中文",
    langHref: "/zh",
    navLive: "Live board",
    navHow: "How it works",
    eyebrow: "One useful app. Nothing else.",
    titleA: "Lock your",
    titleB: "phone.",
    body: "Keep the one app you came for. Lock out every other distraction, let the hours add up, and make your attention visible.",
    cta: "Coming to the App Store",
    explore: "See who is still holding on",
    metricA: "1 app",
    metricAText: "stays available",
    metricB: "∞",
    metricBText: "count-up focus",
    quote: "You don't always need to be productive. Sometimes your phone just needs to be quiet.",
    source: "All code is open source, so the game stays fair.",
    howTitle: "A deliberately small loop.",
    steps: [
      ["01", "Give permission", "Screen Time authorization stays on your device."],
      ["02", "Choose one app", "Reading, ChatGPT, or whichever tool deserves the slot."],
      ["03", "Hold your ground", "Everything else is shielded while your timer keeps moving."],
    ],
    sales: "Cumulative sales",
    estimated: "Estimated gross",
    sold: "paid downloads",
    updated: "Updated",
    ranking: "Longest held",
    live: "Live",
    stale: "Reconnecting",
    empty: "No verified records yet",
    footer: "An independent focus product. iPhone is a trademark of Apple Inc.",
    privacy: "Privacy",
    terms: "Terms",
    support: "Support",
  },
  zh: {
    lang: "English",
    langHref: "/",
    navLive: "实时榜单",
    navHow: "如何使用",
    eyebrow: "只留一个真正需要的 App",
    titleA: "把手机",
    titleB: "占住。",
    body: "只留下你真正需要的那一个 App。其余干扰全部锁住，让时间持续累积，也让专注被看见。",
    cta: "即将上线 App Store",
    explore: "看看谁还在坚持",
    metricA: "1 个",
    metricAText: "唯一白名单",
    metricB: "∞",
    metricBText: "持续正计时",
    quote: "你不必一直高效，偶尔，也该让手机安静下来。",
    source: "所有代码全部开源，证明这场游戏始终公平。",
    howTitle: "一个刻意保持简单的循环。",
    steps: [
      ["01", "完成授权", "屏幕使用时间授权与选择结果只保存在设备上。"],
      ["02", "只选一个 App", "阅读、ChatGPT，或此刻真正值得留下的工具。"],
      ["03", "守住这段时间", "其余 App 全部被系统拦截，计时继续向前。"],
    ],
    sales: "累计销售额",
    estimated: "预估用户支付总额",
    sold: "次付费下载",
    updated: "更新于",
    ranking: "占住时间榜",
    live: "实时",
    stale: "正在重连",
    empty: "暂无已验证记录",
    footer: "独立开发的专注产品。iPhone 是 Apple Inc. 的商标。",
    privacy: "隐私",
    terms: "条款",
    support: "支持",
  },
} as const;

export function SiteHome({ locale }: { locale: Locale }) {
  const c = content[locale];
  const prefix = locale === "zh" ? "/zh" : "";
  return (
    <main lang={locale === "zh" ? "zh-CN" : "en"}>
      <nav className="nav shell">
        <Link href={prefix || "/"} className="brand"><span className="brand-mark"><Image src="/brand-mark.svg" alt="" width={36} height={36} aria-hidden="true" /></span><span>{locale === "zh" ? "占住" : "Lock Phone"}</span></Link>
        <div className="nav-links">
          <a href="#live">{c.navLive}</a>
          <a href="#how">{c.navHow}</a>
          <Link href={c.langHref} className="language">{c.lang}</Link>
        </div>
      </nav>

      <div className="dashboard-wrap shell"><LiveDashboard copy={c} /></div>

      <section className="hero shell">
        <div className="hero-image" aria-hidden="true" />
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow"><span />{c.eyebrow}</p>
          <h1><span>{c.titleA}</span><em>{c.titleB}</em></h1>
          <p className="hero-body">{c.body}</p>
          <div className="hero-actions">
            <span className="store-cta"><span className="apple-glyph">●</span>{c.cta}<ArrowUpRight size={16} /></span>
            <a href="#live" className="text-link">{c.explore}<ArrowDown size={15} /></a>
          </div>
        </div>
        <div className="hero-metrics">
          <div><strong>{c.metricA}</strong><span>{c.metricAText}</span></div>
          <div><strong>{c.metricB}</strong><span>{c.metricBText}</span></div>
        </div>
      </section>

      <section className="manifesto shell"><p>{c.quote}</p><a href="https://github.com/lockphone/lockphone" target="_blank" rel="noreferrer">{c.source}<ArrowUpRight size={16} /></a></section>

      <section className="how shell" id="how">
        <header><p className="section-number">01 — 03</p><h2>{c.howTitle}</h2></header>
        <div className="steps">
          {c.steps.map(([number, title, body], index) => (
            <article key={number}>
              <span>{number}</span>
              <div className="step-icon">{index === 0 ? <LockKeyhole /> : index === 1 ? <span className="one">1</span> : <Volume2 />}</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer shell">
        <p>{c.footer}</p>
        <div>
          <Link href={`${prefix}/privacy`}>{c.privacy}</Link>
          <Link href={`${prefix}/terms`}>{c.terms}</Link>
          <Link href={`${prefix}/support`}>{c.support}</Link>
          <a href="mailto:hello@lockphone.app">Email</a>
          <a href="https://github.com/lockphone/lockphone" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://x.com/lockphoneapp" target="_blank" rel="noreferrer">X</a>
          <a href="https://www.tiktok.com/@lockphoneapp" target="_blank" rel="noreferrer">TikTok</a>
          <a href="https://www.reddit.com/user/lockphoneapp/" target="_blank" rel="noreferrer">Reddit</a>
        </div>
      </footer>
    </main>
  );
}
