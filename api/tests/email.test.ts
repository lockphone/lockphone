import assert from "node:assert/strict";
import test from "node:test";
import type { Config } from "../src/config.js";
import { CloudflareEmailSender } from "../src/email.js";

const config: Config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgres://test",
  PUBLIC_WEB_ORIGINS: "http://localhost:3000",
  AUTH_JWT_SECRET: "a".repeat(32),
  EMAIL_HASH_SECRET: "b".repeat(32),
  EMAIL_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString("base64"),
  OTP_SECRET: "c".repeat(32),
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  CLOUDFLARE_API_TOKEN: "secret-token",
  EMAIL_FROM: "hello@lockphone.app",
  APP_ATTEST_MODE: "disabled",
  APPLE_TEAM_ID: "V6MKVNS45G",
  APPLE_BUNDLE_ID: "www.coreader.studio.lockyour",
};

test("Cloudflare sender posts the bilingual OTP without exposing credentials in the payload", async () => {
  let calledUrl = "";
  let calledInit: RequestInit | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    calledInit = init;
    return new Response(JSON.stringify({ success: true, errors: [], result: { delivered: ["reader@example.com"] } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const sender = new CloudflareEmailSender(config, fetcher);

  await sender.sendOtp({ to: "reader@example.com", code: "123456", locale: "zh-CN" });

  assert.equal(calledUrl, "https://api.cloudflare.com/client/v4/accounts/account-id/email/sending/send");
  assert.equal(calledInit?.method, "POST");
  assert.equal((calledInit?.headers as Record<string, string>).authorization, "Bearer secret-token");
  const payload = JSON.parse(String(calledInit?.body));
  assert.deepEqual(
    { from: payload.from, to: payload.to, subject: payload.subject },
    { from: "hello@lockphone.app", to: "reader@example.com", subject: "你的占住验证码" },
  );
  assert.match(payload.html, /123456/);
  assert.match(payload.html, /href="lockphone:\/\/verify-email"/);
  assert.match(payload.text, /lockphone:\/\/verify-email/);
  assert.doesNotMatch(String(calledInit?.body), /secret-token/);
});
