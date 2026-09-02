import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { AppAttestService } from "./app-attest.js";
import { AppleSalesImporter } from "./apple-sales.js";
import type { Config } from "./config.js";
import { webOrigins } from "./config.js";
import { Database } from "./database.js";
import type { EmailSender } from "./email.js";
import { CloudflareEmailSender } from "./email.js";
import { RealtimeHub } from "./realtime.js";
import {
  constantTimeEqual,
  normalizeEmail,
  otpHash,
  randomToken,
  sha256,
  signAccessToken,
  sixDigitCode,
  validateNickname,
  verifyAccessToken,
} from "./security.js";
import type { AuthContext, Locale } from "./types.js";

const emailSchema = z.string().email().max(254).transform(normalizeEmail);
const idempotencySchema = z.string().min(12).max(128);
const uuidSchema = z.string().uuid();

function bearer(request: FastifyRequest) {
  const value = request.headers.authorization;
  if (!value?.startsWith("Bearer ")) throw new Error("AUTH_REQUIRED");
  return value.slice(7);
}

function locale(value: unknown): Locale {
  return typeof value === "string" && value.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function safeError(error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  const known = new Set([
    "AUTH_REQUIRED", "DEVICE_SECRET_MISMATCH", "INVALID_REFRESH_TOKEN", "OTP_RATE_LIMITED",
    "OTP_INVALID", "OTP_EXPIRED", "OTP_ALREADY_USED", "SESSION_NOT_FOUND", "APP_ATTEST_REQUIRED",
    "APP_ATTEST_CHALLENGE_INVALID", "APP_ATTEST_KEY_UNKNOWN", "APP_ATTEST_COUNTER_REPLAY",
  ]);
  return known.has(code) ? code : "REQUEST_FAILED";
}

function statusFor(code: string) {
  if (code === "AUTH_REQUIRED" || code.startsWith("APP_ATTEST") || code.includes("TOKEN") || code === "DEVICE_SECRET_MISMATCH") return 401;
  if (code === "SESSION_NOT_FOUND") return 404;
  if (code === "OTP_RATE_LIMITED") return 429;
  return 400;
}

async function tokens(config: Config, database: Database, auth: AuthContext) {
  const refreshToken = randomToken(40);
  const refreshExpiresAt = new Date(Date.now() + 30 * 86_400_000);
  await database.storeRefreshToken(auth.deviceId, refreshToken, refreshExpiresAt);
  return {
    accessToken: await signAccessToken(config, auth),
    accessExpiresIn: 1_800,
    refreshToken,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  };
}

export async function buildServer(input: { config: Config; pool: Pool; emailSender?: EmailSender }) {
  const { config, pool } = input;
  const database = new Database(pool, config);
  await database.migrate();
  const app = Fastify({ logger: { redact: ["req.headers.authorization", "req.headers.x-app-attest-assertion"] } });
  const hub = new RealtimeHub(database);
  const attestation = new AppAttestService(config, database);
  const sales = new AppleSalesImporter(config, database);
  const emailSender = input.emailSender ?? (
    config.CLOUDFLARE_ACCOUNT_ID && config.CLOUDFLARE_API_TOKEN
      ? new CloudflareEmailSender(config)
      : null
  );

  await app.register(cors, {
    origin: (origin, callback) => callback(null, !origin || webOrigins(config).includes(origin)),
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  await app.register(websocket);

  const authenticate = async (request: FastifyRequest) => verifyAccessToken(config, bearer(request));
  const verifySensitive = async (request: FastifyRequest, auth: AuthContext) => {
    await attestation.verifyAssertion({
      ...auth,
      challenge: request.headers["x-app-attest-challenge"] as string | undefined,
      keyId: request.headers["x-app-attest-key-id"] as string | undefined,
      assertion: request.headers["x-app-attest-assertion"] as string | undefined,
    });
  };

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: "INVALID_REQUEST", requestId: request.id });
    }
    const code = safeError(error);
    if (code === "REQUEST_FAILED") request.log.error({ err: error }, "request failed");
    return reply.code(statusFor(code)).send({ error: code, requestId: request.id });
  });

  app.get("/healthz", async () => ({ status: "ok" }));

  app.post("/v1/devices/register", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = z.object({
      installId: uuidSchema,
      deviceSecret: z.string().min(32).max(256),
      locale: z.string().max(24).default("en"),
      appAttestKeyId: z.string().max(512).optional(),
    }).parse(request.body);
    const auth = await database.registerDevice(body);
    return reply.code(201).send({ userId: auth.userId, deviceId: auth.deviceId, ...(await tokens(config, database, auth)) });
  });

  app.post("/v1/auth/refresh", async (request) => {
    const body = z.object({ refreshToken: z.string().min(40).max(256) }).parse(request.body);
    const next = randomToken(40);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000);
    const auth = await database.rotateRefreshToken(body.refreshToken, next, expiresAt);
    return {
      accessToken: await signAccessToken(config, auth), accessExpiresIn: 1_800,
      refreshToken: next, refreshExpiresAt: expiresAt.toISOString(),
    };
  });

  app.post("/v1/attest/challenge", async (request) => {
    const auth = await authenticate(request);
    const challenge = randomToken(32);
    await attestation.issueChallenge(auth, challenge);
    return { challenge, expiresIn: 300 };
  });

  app.post("/v1/attest/verify", async (request, reply) => {
    const auth = await authenticate(request);
    const body = z.object({ challenge: z.string().min(20), keyId: z.string().min(20), attestation: z.string().min(40) }).parse(request.body);
    await attestation.verifyKey({ ...auth, ...body });
    return reply.code(204).send();
  });

  app.post("/v1/auth/email/request", {
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
  }, async (request, reply) => {
    const auth = await authenticate(request);
    const body = z.object({ email: emailSchema, locale: z.string().optional() }).parse(request.body);
    if (!emailSender) return reply.code(503).send({ error: "EMAIL_UNAVAILABLE", requestId: request.id });
    const code = sixDigitCode();
    await database.createOtp({
      userId: auth.userId, email: body.email, codeHash: otpHash(config, body.email, code),
      locale: locale(body.locale), expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    await emailSender.sendOtp({ to: body.email, code, locale: locale(body.locale) });
    return reply.code(202).send({ expiresIn: 600, resendAfter: 60 });
  });

  app.post("/v1/auth/email/verify", async (request) => {
    const auth = await authenticate(request);
    await verifySensitive(request, auth);
    const body = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) }).parse(request.body);
    const otp = await database.latestOtp(auth.userId, body.email);
    if (!otp || otp.consumed_at || otp.attempts >= 5) throw new Error("OTP_INVALID");
    if (new Date(otp.expires_at).getTime() < Date.now()) throw new Error("OTP_EXPIRED");
    if (!constantTimeEqual(otp.code_hash, otpHash(config, body.email, body.code))) {
      await database.recordOtpFailure(otp.id);
      throw new Error("OTP_INVALID");
    }
    const userId = await database.bindVerifiedEmail(auth.userId, body.email, otp.id);
    const nextAuth = { userId, deviceId: auth.deviceId };
    await hub.sendSnapshot();
    return { userId, deviceId: auth.deviceId, ...(await tokens(config, database, nextAuth)) };
  });

  app.get("/v1/me", async (request) => {
    const auth = await authenticate(request);
    const profile = await database.profile(auth.userId);
    if (!profile) throw new Error("AUTH_REQUIRED");
    return profile;
  });

  app.patch("/v1/me", async (request) => {
    const auth = await authenticate(request);
    const body = z.object({
      nickname: z.string().optional().transform((value) => value === undefined ? undefined : validateNickname(value)),
      avatarId: z.number().int().min(0).max(179).optional(),
    }).refine((value) => value.nickname !== undefined || value.avatarId !== undefined).parse(request.body);
    const profile = await database.updateProfile(auth.userId, body);
    await hub.sendSnapshot();
    return profile;
  });

  app.delete("/v1/me", async (request, reply) => {
    const auth = await authenticate(request);
    await verifySensitive(request, auth);
    await database.deleteUser(auth.userId);
    await hub.sendSnapshot();
    return reply.code(204).send();
  });

  app.delete("/v1/devices/current", async (request, reply) => {
    const auth = await authenticate(request);
    await database.revokeDevice(auth.deviceId);
    return reply.code(204).send();
  });

  app.post("/v1/sessions/start", async (request, reply) => {
    const auth = await authenticate(request);
    await verifySensitive(request, auth);
    const body = z.object({ clientSessionId: uuidSchema }).parse(request.body);
    const idempotencyKey = idempotencySchema.parse(request.headers["idempotency-key"]);
    const session = await database.startSession({ ...auth, clientSessionId: body.clientSessionId, idempotencyKey });
    await hub.sendSnapshot();
    return reply.code(201).send({
      id: session.id, clientSessionId: session.client_session_id, startedAt: new Date(session.started_at).toISOString(),
    });
  });

  app.post("/v1/sessions/:id/stop", async (request) => {
    const auth = await authenticate(request);
    await verifySensitive(request, auth);
    const parameters = z.object({ id: uuidSchema }).parse(request.params);
    const idempotencyKey = idempotencySchema.parse(request.headers["idempotency-key"]);
    const result = await database.stopSession({ userId: auth.userId, sessionId: parameters.id, idempotencyKey });
    await hub.sendSnapshot();
    return { id: result.id, endedAt: result.endedAt.toISOString(), creditedSeconds: result.creditedSeconds };
  });

  app.post("/v1/sessions/reconcile", async (request, reply) => {
    const auth = await authenticate(request);
    await verifySensitive(request, auth);
    const body = z.object({
      clientSessionId: uuidSchema,
      startedAt: z.coerce.date(),
      endedAt: z.coerce.date(),
    }).refine((value) => value.endedAt >= value.startedAt).parse(request.body);
    const idempotencyKey = idempotencySchema.parse(request.headers["idempotency-key"]);
    const result = await database.reconcileSession({ ...auth, ...body, idempotencyKey });
    await hub.sendSnapshot();
    return reply.code(201).send(result);
  });

  app.get("/v1/me/stats", async (request) => {
    const auth = await authenticate(request);
    const profile = await database.profile(auth.userId);
    if (!profile) throw new Error("AUTH_REQUIRED");
    return { totalSeconds: profile.totalSeconds, activeStartedAt: profile.activeStartedAt, rank: await database.rankForUser(auth.userId) };
  });

  app.get("/v1/public/snapshot", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
    return database.publicSnapshot();
  });

  app.post("/v1/public/reports", {
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
  }, async (request, reply) => {
    const body = z.object({ userId: uuidSchema, reason: z.string().min(3).max(500) }).parse(request.body);
    const fingerprint = sha256(`${request.ip}:${request.headers["user-agent"] ?? "unknown"}`);
    await database.reportUser({ ...body, fingerprint });
    return reply.code(202).send({ accepted: true });
  });

  app.get("/v1/live", { websocket: true }, async (socket) => {
    hub.add(socket);
    await hub.sendSnapshot(socket);
  });

  let salesTimer: NodeJS.Timeout | undefined;
  app.addHook("onReady", async () => {
    if (!sales.configured) return;
    const run = async () => {
      try {
        if (await sales.importLatest()) await hub.sendSnapshot();
      } catch (error) {
        app.log.error({ err: error }, "sales import failed");
      }
    };
    setTimeout(run, 10_000).unref();
    salesTimer = setInterval(run, 2 * 60 * 60_000);
    salesTimer.unref();
  });
  app.addHook("onClose", async () => {
    if (salesTimer) clearInterval(salesTimer);
  });

  return { app, database, hub };
}
