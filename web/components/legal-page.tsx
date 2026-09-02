import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type Locale = "en" | "zh";
type Kind = "privacy" | "terms" | "support";

const pages = {
  en: {
    privacy: {
      title: "Privacy",
      intro: "Lock Phone collects only the information needed to register time, restore an account, and operate the public leaderboard.",
      sections: [
        ["What we collect", "A verified email address, a public nickname and system avatar choice, device identifiers used for security, and the start and end times of locking sessions."],
        ["What stays on your phone", "Your Family Controls selections are privacy-preserving Apple tokens. They remain in the App Group on your device and are never uploaded."],
        ["How data is used", "We use account data to restore accumulated time and session data to calculate your ranking. We do not sell data, serve targeted advertising, or track you across apps."],
        ["Deletion", "You can permanently delete your account inside the app. This removes your email, profile, devices, sessions, and leaderboard entry."],
      ],
    },
    terms: {
      title: "Terms",
      intro: "Lock Phone is a focus aid built with Apple’s Family Controls frameworks. It does not lock the iPhone operating system itself.",
      sections: [
        ["Use of the service", "Use the app only on devices and accounts you control. You may revoke Screen Time authorization from iOS Settings at any time."],
        ["Leaderboard", "Rankings are based on validated session records and may be corrected when duplicated, manipulated, or technically invalid activity is detected."],
        ["Availability", "Family Controls behavior, App Store reports, and background execution depend on Apple services. Real-time sales figures are estimates based on delayed reports."],
        ["Fair use", "Public nicknames must not be abusive, illegal, impersonating, or infringing. We may hide entries that violate this rule."],
      ],
    },
    support: {
      title: "Support",
      intro: "If Lock Phone is not behaving as expected, the checks below solve the most common cases.",
      sections: [
        ["Apps are not blocked", "Open Lock Phone and grant Screen Time authorization. If permission was revoked in Settings, the app will show the authorization screen again."],
        ["Change the allowed app", "End the current session by holding the stop control for two seconds. You can change the single allowlist slot before starting again."],
        ["Email code did not arrive", "Check spam, wait sixty seconds, and resend. Codes expire after ten minutes."],
        ["Contact", "Email hello@lockphone.app. Include your app version and iOS version, but never send a verification code or token."],
      ],
    },
    back: "Back to Lock Phone",
    updated: "Last updated September 1, 2026",
  },
  zh: {
    privacy: {
      title: "隐私政策",
      intro: "占住只收集登记累计时间、恢复账户和运行公开排行榜所必需的信息。",
      sections: [
        ["我们收集什么", "已验证邮箱、公开昵称、系统头像选择、安全所需的设备标识，以及每次锁机的开始和结束时间。"],
        ["只留在设备上的内容", "白名单是 Apple 提供的隐私 Token，仅保存在设备 App Group 中，永远不会上传服务器。"],
        ["信息如何使用", "账户数据用于恢复累计时间，session 数据用于计算排名。我们不出售数据、不投放定向广告，也不跨 App 跟踪。"],
        ["删除账户", "你可以在 App 内永久删除账户；邮箱、资料、设备、session 与排行榜记录会一并删除。"],
      ],
    },
    terms: {
      title: "使用条款",
      intro: "占住是使用 Apple Family Controls 构建的专注工具，并不会锁定 iPhone 操作系统本身。",
      sections: [
        ["服务使用", "只能在你有权控制的设备和账户上使用。你可以随时在 iOS 设置中撤销屏幕使用时间授权。"],
        ["排行榜", "排名依据有效 session 计算；重复、篡改或技术上无效的数据可能被修正。"],
        ["可用性", "Family Controls、App Store 报表和后台运行依赖 Apple 服务。实时销售金额是基于延迟报表的估算值。"],
        ["公平使用", "公开昵称不得包含辱骂、违法、冒充或侵权内容；违规条目可能被隐藏。"],
      ],
    },
    support: {
      title: "支持",
      intro: "如果占住没有按预期运行，可以先检查下面几个常见情况。",
      sections: [
        ["其他 App 没有被拦截", "打开占住并授予屏幕使用时间权限。如果已在系统设置中撤销，App 会重新显示授权页面。"],
        ["更换白名单 App", "长按结束控件两秒结束当前 session，然后在再次开始前更换唯一白名单。"],
        ["没有收到邮箱验证码", "检查垃圾邮件，等待六十秒后重发。验证码十分钟后失效。"],
        ["联系我们", "发送邮件至 hello@lockphone.app，并附上 App 与 iOS 版本。请勿发送验证码或 Token。"],
      ],
    },
    back: "返回占住",
    updated: "最后更新：2026 年 9 月 1 日",
  },
} as const;

export function LegalPage({ locale, kind }: { locale: Locale; kind: Kind }) {
  const c = pages[locale];
  const page = c[kind];
  const home = locale === "zh" ? "/zh" : "/";
  return (
    <main className="legal shell" lang={locale === "zh" ? "zh-CN" : "en"}>
      <Link href={home} className="legal-back"><ArrowLeft size={15} />{c.back}</Link>
      <header><span className="brand-mark"><Image src="/brand-mark.svg" alt="" width={36} height={36} aria-hidden="true" /></span><h1>{page.title}</h1><p>{page.intro}</p><small>{c.updated}</small></header>
      <div className="legal-sections">
        {page.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
      </div>
    </main>
  );
}
