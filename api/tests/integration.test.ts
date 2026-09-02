import assert from "node:assert/strict";
import test from "node:test";
import { DataType, newDb } from "pg-mem";
import type { Config } from "../src/config.js";
import type { EmailSender } from "../src/email.js";
import { buildServer } from "../src/server.js";

const config: Config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgres://memory",
  PUBLIC_WEB_ORIGINS: "http://localhost:3000",
  AUTH_JWT_SECRET: "a".repeat(32),
  EMAIL_HASH_SECRET: "b".repeat(32),
  EMAIL_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString("base64"),
  OTP_SECRET: "c".repeat(32),
  EMAIL_FROM: "test@example.com",
  APP_ATTEST_MODE: "disabled",
  APPLE_TEAM_ID: "V6MKVNS45G",
  APPLE_BUNDLE_ID: "www.coreader.studio.lockyour",
};

test("anonymous device, OTP account and reconciled session form one idempotent leaderboard total", async () => {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  memory.public.registerOperator({
    operator: "-",
    left: DataType.timestamptz,
    right: DataType.timestamptz,
    returns: DataType.interval,
    implementation: (left: Date, right: Date) => ({ milliseconds: left.getTime() - right.getTime() }),
  });
  memory.public.registerFunction({
    name: "least",
    args: [DataType.interval, DataType.interval],
    returns: DataType.interval,
    implementation: (left: Record<string, number>, right: Record<string, number>) => {
      const milliseconds = (value: Record<string, number>) =>
        (value.days ?? 0) * 86_400_000 + (value.hours ?? 0) * 3_600_000 +
        (value.minutes ?? 0) * 60_000 + (value.seconds ?? 0) * 1_000 + (value.milliseconds ?? 0);
      return milliseconds(left) <= milliseconds(right) ? left : right;
    },
  });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  let deliveredCode = "";
  const emailSender: EmailSender = {
    async sendOtp(input) { deliveredCode = input.code; },
  };
  const { app, database } = await buildServer({ config, pool, emailSender });

  const installId = "2dbde440-4262-40ce-b53c-9cc02b692ba4";
  const registration = await app.inject({
    method: "POST",
    url: "/v1/devices/register",
    payload: { installId, deviceSecret: "d".repeat(40), locale: "zh-CN" },
  });
  assert.equal(registration.statusCode, 201);
  const auth = registration.json<{ accessToken: string }>();
  const headers = { authorization: `Bearer ${auth.accessToken}` };

  const otpRequest = await app.inject({
    method: "POST",
    url: "/v1/auth/email/request",
    headers,
    payload: { email: "reader@example.com", locale: "zh-CN" },
  });
  assert.equal(otpRequest.statusCode, 202);
  assert.match(deliveredCode, /^\d{6}$/);

  const verification = await app.inject({
    method: "POST",
    url: "/v1/auth/email/verify",
    headers,
    payload: { email: "reader@example.com", code: deliveredCode },
  });
  assert.equal(verification.statusCode, 200);
  const verified = verification.json<{ accessToken: string }>();
  const verifiedHeaders = {
    authorization: `Bearer ${verified.accessToken}`,
    "idempotency-key": "stop-75bccba6-86f7-49ab-b3cf-41573f13984c",
  };

  const end = new Date();
  const start = new Date(end.getTime() - 125_000);
  const payload = {
    clientSessionId: "75bccba6-86f7-49ab-b3cf-41573f13984c",
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
  };
  const first = await app.inject({ method: "POST", url: "/v1/sessions/reconcile", headers: verifiedHeaders, payload });
  const duplicate = await app.inject({ method: "POST", url: "/v1/sessions/reconcile", headers: verifiedHeaders, payload });
  assert.equal(first.statusCode, 201);
  assert.equal(duplicate.statusCode, 201);
  assert.equal(first.json<{ creditedSeconds: number }>().creditedSeconds, 125);
  assert.equal(duplicate.json<{ creditedSeconds: number }>().creditedSeconds, 125);

  const stats = await app.inject({
    method: "GET",
    url: "/v1/me/stats",
    headers: { authorization: `Bearer ${verified.accessToken}` },
  });
  assert.equal(stats.statusCode, 200);
  assert.equal(stats.json<{ totalSeconds: number }>().totalSeconds, 125);

  const snapshot = await app.inject({ method: "GET", url: "/v1/public/snapshot" });
  assert.equal(snapshot.statusCode, 200);
  const publicData = snapshot.json<{ leaderboard: Array<{ maskedEmail: string; creditedSeconds: number }> }>();
  assert.equal(publicData.leaderboard[0]?.maskedEmail, "re***@example.com");
  assert.equal(publicData.leaderboard[0]?.creditedSeconds, 125);

  await database.replaceSalesReport("2026-08-31", "a".repeat(64), []);
  const emptySalesSnapshot = await database.publicSnapshot();
  assert.match(emptySalesSnapshot.sales.reportThrough ?? "", /^2026-08-31/);
  assert.equal(emptySalesSnapshot.sales.paidUnits, 0);
  assert.equal(emptySalesSnapshot.sales.grossCnyEstimate, 0);

  await app.close();
  await database.close();
});
