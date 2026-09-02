import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Config } from "./config.js";
import type { AuthContext } from "./types.js";

const bannedFragments = ["nazi", "hitler", "习近平", "操你", "fuck", "porn"];

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function maskEmail(value: string) {
  const email = normalizeEmail(value);
  const [local = "", domain = ""] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function keyedHash(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function emailLookupHash(config: Config, email: string) {
  return keyedHash(config.EMAIL_HASH_SECRET, normalizeEmail(email));
}

export function otpHash(config: Config, email: string, code: string) {
  return keyedHash(config.OTP_SECRET, `${normalizeEmail(email)}:${code}`);
}

export function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function encryptEmail(config: Config, email: string) {
  const key = Buffer.from(config.EMAIL_ENCRYPTION_KEY_BASE64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(normalizeEmail(email), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptEmail(config: Config, payload: string) {
  const [ivText, tagText, dataText] = payload.split(".");
  if (!ivText || !tagText || !dataText) throw new Error("Invalid encrypted email");
  const key = Buffer.from(config.EMAIL_ENCRYPTION_KEY_BASE64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sixDigitCode() {
  const number = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(number).padStart(6, "0");
}

export function defaultNickname(userId: string) {
  const suffix = Number.parseInt(sha256(userId).slice(0, 5), 16) % 10_000;
  return `Focus ${String(suffix).padStart(4, "0")}`;
}

export function defaultAvatar(userId: string) {
  return Number.parseInt(sha256(userId).slice(5, 10), 16) % 180;
}

export function validateNickname(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 24) throw new Error("Nickname must be between 2 and 24 characters");
  const lowered = normalized.toLowerCase();
  if (bannedFragments.some((fragment) => lowered.includes(fragment))) throw new Error("Nickname is not allowed");
  return normalized;
}

function jwtKey(config: Config) {
  return new TextEncoder().encode(config.AUTH_JWT_SECRET);
}

export async function signAccessToken(config: Config, auth: AuthContext) {
  return new SignJWT({ deviceId: auth.deviceId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(auth.userId)
    .setIssuer("lock-api")
    .setAudience("lock-your-ios")
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(jwtKey(config));
}

export async function verifyAccessToken(config: Config, token: string): Promise<AuthContext> {
  const { payload } = await jwtVerify(token, jwtKey(config), {
    issuer: "lock-api",
    audience: "lock-your-ios",
  });
  if (!payload.sub || typeof payload.deviceId !== "string") throw new Error("Invalid access token");
  return { userId: payload.sub, deviceId: payload.deviceId };
}

