import type { Config } from "./config.js";
import type { Locale } from "./types.js";

export interface EmailSender {
  sendOtp(input: { to: string; code: string; locale: Locale }): Promise<void>;
}

function message(locale: Locale) {
  if (locale === "zh-CN") {
    return {
      subject: "你的占住验证码",
      title: "验证邮箱",
      body: "输入下面的验证码，把当前设备上的累计时间登记到你的邮箱。",
      label: "验证码",
      ignore: "如果不是你发起的请求，可以忽略这封邮件。",
      returnLabel: "返回占住",
      returnHint: "验证码不会包含在链接中。返回 App 后输入这封邮件里的验证码即可完成登记。",
    };
  }
  return {
    subject: "Your Lock Your verification code",
    title: "Verify your email",
    body: "Enter the code below to register this device’s accumulated focus time to your email.",
    label: "Verification code",
    ignore: "If you did not request this email, you can safely ignore it.",
    returnLabel: "Return to Lock Your",
    returnHint: "The link never contains your code. Return to the app, then enter the code from this email.",
  };
}

type CloudflareResponse = {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
};

export class CloudflareEmailSender implements EmailSender {
  constructor(
    private readonly config: Config,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!config.CLOUDFLARE_ACCOUNT_ID) throw new Error("CLOUDFLARE_ACCOUNT_ID is required for email delivery");
    if (!config.CLOUDFLARE_API_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN is required for email delivery");
  }

  async sendOtp(input: { to: string; code: string; locale: Locale }) {
    const copy = message(input.locale);
    const returnURL = "lockyour://verify-email";
    const html = `<!doctype html><html lang="${input.locale}"><body style="margin:0;background:#11120f;color:#f2eee5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="100%" style="max-width:560px;background:#191a17;border:1px solid #34342f;border-radius:24px"><tr><td style="padding:38px"><p style="margin:0 0 28px;color:#ef7d45;font-size:14px;font-weight:700;letter-spacing:.08em">占住 · LOCK YOUR</p><h1 style="margin:0 0 14px;font-size:28px">${copy.title}</h1><p style="margin:0;color:#aaa69e;line-height:1.7">${copy.body}</p><p style="margin:26px 0 8px;color:#8f8b82;font-size:12px">${copy.label}</p><div style="border-radius:16px;background:#f2eee5;color:#11120f;padding:18px;text-align:center;font:600 30px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:7px">${input.code}</div><p style="margin:22px 0 12px"><a href="${returnURL}" style="display:inline-block;border-radius:999px;background:#ef7d45;color:#11120f;padding:12px 18px;text-decoration:none;font-weight:700">${copy.returnLabel}</a></p><p style="margin:0;color:#8f8b82;font-size:12px;line-height:1.6">${copy.returnHint}</p><p style="margin:28px 0 0;color:#77746e;font-size:12px;line-height:1.6">${copy.ignore}</p></td></tr></table></td></tr></table></body></html>`;
    const response = await this.fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.CLOUDFLARE_API_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.config.EMAIL_FROM,
          to: input.to,
          subject: copy.subject,
          html,
          text: `${copy.title}\n\n${copy.body}\n\n${copy.label}: ${input.code}\n\n${copy.returnLabel}: ${returnURL}\n${copy.returnHint}\n\n${copy.ignore}`,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const result = await response.json().catch(() => null) as CloudflareResponse | null;
    if (!response.ok || !result?.success) {
      const code = result?.errors?.[0]?.code ?? response.status;
      throw new Error(`Email delivery failed (${code})`);
    }
  }
}
