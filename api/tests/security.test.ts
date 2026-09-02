import assert from "node:assert/strict";
import test from "node:test";
import type { Config } from "../src/config.js";
import {
  constantTimeEqual,
  decryptEmail,
  emailLookupHash,
  encryptEmail,
  maskEmail,
  otpHash,
  signAccessToken,
  validateNickname,
  verifyAccessToken,
} from "../src/security.js";

const config: Config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgres://test",
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

test("email values are normalized, masked, encrypted and looked up deterministically", () => {
  const encrypted = encryptEmail(config, " User.Name@Example.com ");
  assert.equal(decryptEmail(config, encrypted), "user.name@example.com");
  assert.equal(maskEmail("User.Name@example.com"), "us***@example.com");
  assert.equal(emailLookupHash(config, "USER.NAME@example.com"), emailLookupHash(config, "user.name@example.com"));
});

test("OTP hashes use constant-time comparison", () => {
  const hash = otpHash(config, "user@example.com", "123456");
  assert.equal(constantTimeEqual(hash, otpHash(config, "USER@example.com", "123456")), true);
  assert.equal(constantTimeEqual(hash, otpHash(config, "user@example.com", "000000")), false);
});

test("access token carries the user and device", async () => {
  const token = await signAccessToken(config, { userId: "user-id", deviceId: "device-id" });
  assert.deepEqual(await verifyAccessToken(config, token), { userId: "user-id", deviceId: "device-id" });
});

test("nickname validation rejects banned or oversized public content", () => {
  assert.equal(validateNickname("  Quiet   North "), "Quiet North");
  assert.throws(() => validateNickname("fuck this"));
  assert.throws(() => validateNickname("x"));
});
