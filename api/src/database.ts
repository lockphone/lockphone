import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Config } from "./config.js";
import {
  decryptEmail,
  defaultAvatar,
  defaultNickname,
  emailLookupHash,
  encryptEmail,
  maskEmail,
  sha256,
} from "./security.js";
import type { Profile, PublicSnapshot } from "./types.js";

const migration = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email_hash text UNIQUE,
  email_ciphertext text,
  email_masked text,
  email_verified_at timestamptz,
  nickname text NOT NULL,
  avatar_id integer NOT NULL CHECK (avatar_id >= 0 AND avatar_id < 180),
  total_seconds bigint NOT NULL DEFAULT 0 CHECK (total_seconds >= 0),
  public_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  install_id_hash text NOT NULL UNIQUE,
  device_secret_hash text NOT NULL,
  app_attest_key_id text,
  app_attest_public_key text,
  app_attest_counter bigint NOT NULL DEFAULT 0,
  locale text NOT NULL DEFAULT 'en',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_attest_challenges (
  challenge_hash text PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_otps (
  id uuid PRIMARY KEY,
  requested_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_hash text NOT NULL,
  email_ciphertext text NOT NULL,
  code_hash text NOT NULL,
  locale text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_otps_lookup_idx ON email_otps(requested_by_user_id, email_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS lock_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  client_session_id text NOT NULL UNIQUE,
  start_idempotency_key text NOT NULL UNIQUE,
  stop_idempotency_key text UNIQUE,
  status text NOT NULL CHECK (status IN ('active', 'ended')),
  source text NOT NULL CHECK (source IN ('online', 'offline_reconcile')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  credited_seconds integer NOT NULL DEFAULT 0 CHECK (credited_seconds >= 0 AND credited_seconds <= 86400),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_session_per_device ON lock_sessions(device_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS lock_sessions_user_idx ON lock_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS sales_daily (
  source_key text PRIMARY KEY,
  report_date date NOT NULL,
  country_code text NOT NULL,
  customer_currency text NOT NULL,
  customer_price numeric(14,4) NOT NULL,
  units integer NOT NULL,
  gross_cny numeric(16,4) NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_imports (
  report_date date PRIMARY KEY,
  source_sha256 text NOT NULL,
  row_count integer NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_reports (
  id uuid PRIMARY KEY,
  reported_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  reporter_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_reports_user_idx ON moderation_reports(reported_user_id, created_at DESC);
`;

async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function int(value: unknown) {
  return Number.parseInt(String(value ?? 0), 10) || 0;
}

function isoDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export class Database {
  constructor(private readonly pool: Pool, private readonly config: Config) {}

  async migrate() {
    await this.pool.query(migration);
  }

  async close() {
    await this.pool.end();
  }

  async registerDevice(input: {
    installId: string;
    deviceSecret: string;
    locale: string;
    appAttestKeyId?: string | undefined;
  }) {
    const installHash = sha256(input.installId);
    const secretHash = sha256(input.deviceSecret);
    return transaction(this.pool, async (client) => {
      const existing = await client.query<{
        id: string;
        user_id: string;
        device_secret_hash: string;
      }>("SELECT id, user_id, device_secret_hash FROM devices WHERE install_id_hash = $1 FOR UPDATE", [installHash]);
      if (existing.rowCount) {
        const device = existing.rows[0]!;
        if (device.device_secret_hash !== secretHash) throw new Error("DEVICE_SECRET_MISMATCH");
        await client.query(
          "UPDATE devices SET last_seen_at = now(), locale = $2, app_attest_key_id = COALESCE($3, app_attest_key_id) WHERE id = $1",
          [device.id, input.locale, input.appAttestKeyId ?? null],
        );
        return { deviceId: device.id, userId: device.user_id };
      }

      const userId = randomUUID();
      const deviceId = randomUUID();
      await client.query(
        "INSERT INTO users(id, nickname, avatar_id) VALUES ($1, $2, $3)",
        [userId, defaultNickname(userId), defaultAvatar(userId)],
      );
      await client.query(
        `INSERT INTO devices(id, user_id, install_id_hash, device_secret_hash, app_attest_key_id, locale)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [deviceId, userId, installHash, secretHash, input.appAttestKeyId ?? null, input.locale],
      );
      return { deviceId, userId };
    });
  }

  async storeRefreshToken(deviceId: string, token: string, expiresAt: Date) {
    await this.pool.query(
      "INSERT INTO refresh_tokens(id, device_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
      [randomUUID(), deviceId, sha256(token), expiresAt],
    );
  }

  async rotateRefreshToken(oldToken: string, nextToken: string, expiresAt: Date) {
    return transaction(this.pool, async (client) => {
      const result = await client.query<{ device_id: string; user_id: string }>(
        `SELECT rt.device_id, d.user_id
         FROM refresh_tokens rt JOIN devices d ON d.id = rt.device_id
         WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now()
         FOR UPDATE`,
        [sha256(oldToken)],
      );
      const current = result.rows[0];
      if (!current) throw new Error("INVALID_REFRESH_TOKEN");
      await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1", [sha256(oldToken)]);
      await client.query(
        "INSERT INTO refresh_tokens(id, device_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
        [randomUUID(), current.device_id, sha256(nextToken), expiresAt],
      );
      return { deviceId: current.device_id, userId: current.user_id };
    });
  }

  async revokeDevice(deviceId: string) {
    await this.pool.query("DELETE FROM devices WHERE id = $1", [deviceId]);
  }

  async createAttestChallenge(deviceId: string, challenge: string) {
    await this.pool.query(
      "INSERT INTO app_attest_challenges(challenge_hash, device_id, expires_at) VALUES ($1, $2, now() + interval '5 minutes')",
      [sha256(challenge), deviceId],
    );
  }

  async consumeAttestChallenge(deviceId: string, challenge: string) {
    return transaction(this.pool, async (client) => {
      const result = await client.query<{ challenge_hash: string }>(
        `SELECT challenge_hash FROM app_attest_challenges
         WHERE challenge_hash = $1 AND device_id = $2 AND consumed_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [sha256(challenge), deviceId],
      );
      if (!result.rows[0]) return false;
      await client.query("UPDATE app_attest_challenges SET consumed_at = now() WHERE challenge_hash = $1", [sha256(challenge)]);
      return true;
    });
  }

  async saveAttestation(deviceId: string, keyId: string, publicKey: string) {
    await this.pool.query(
      `UPDATE devices SET app_attest_key_id = $2, app_attest_public_key = $3,
       app_attest_counter = 0, last_seen_at = now() WHERE id = $1`,
      [deviceId, keyId, publicKey],
    );
  }

  async attestation(deviceId: string, keyId: string) {
    const result = await this.pool.query<{ public_key: string; counter: string }>(
      `SELECT app_attest_public_key AS public_key, app_attest_counter::text AS counter
       FROM devices WHERE id = $1 AND app_attest_key_id = $2`,
      [deviceId, keyId],
    );
    const row = result.rows[0];
    return row?.public_key ? { publicKey: row.public_key, counter: int(row.counter) } : null;
  }

  async updateAttestationCounter(deviceId: string, keyId: string, counter: number) {
    const result = await this.pool.query(
      `UPDATE devices SET app_attest_counter = $3, last_seen_at = now()
       WHERE id = $1 AND app_attest_key_id = $2 AND app_attest_counter < $3`,
      [deviceId, keyId, counter],
    );
    if (!result.rowCount) throw new Error("APP_ATTEST_COUNTER_REPLAY");
  }

  async createOtp(input: {
    userId: string;
    email: string;
    codeHash: string;
    locale: string;
    expiresAt: Date;
  }) {
    const emailHash = emailLookupHash(this.config, input.email);
    const recent = await this.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM email_otps
       WHERE requested_by_user_id = $1 AND created_at > now() - interval '1 hour'`,
      [input.userId],
    );
    if (int(recent.rows[0]?.count) >= 5) throw new Error("OTP_RATE_LIMITED");
    await this.pool.query(
      `INSERT INTO email_otps(id, requested_by_user_id, email_hash, email_ciphertext, code_hash, locale, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), input.userId, emailHash, encryptEmail(this.config, input.email), input.codeHash, input.locale, input.expiresAt],
    );
  }

  async latestOtp(userId: string, email: string) {
    const result = await this.pool.query<{
      id: string;
      code_hash: string;
      attempts: number;
      expires_at: Date;
      consumed_at: Date | null;
    }>(
      `SELECT id, code_hash, attempts, expires_at, consumed_at
       FROM email_otps WHERE requested_by_user_id = $1 AND email_hash = $2
       ORDER BY created_at DESC LIMIT 1`,
      [userId, emailLookupHash(this.config, email)],
    );
    return result.rows[0] ?? null;
  }

  async recordOtpFailure(id: string) {
    await this.pool.query("UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1", [id]);
  }

  async bindVerifiedEmail(userId: string, email: string, otpId: string) {
    const emailHash = emailLookupHash(this.config, email);
    return transaction(this.pool, async (client) => {
      const otp = await client.query<{ consumed_at: Date | null }>(
        "SELECT consumed_at FROM email_otps WHERE id = $1 FOR UPDATE",
        [otpId],
      );
      if (!otp.rows[0] || otp.rows[0].consumed_at) throw new Error("OTP_ALREADY_USED");
      const target = await client.query<{ id: string }>("SELECT id FROM users WHERE email_hash = $1 FOR UPDATE", [emailHash]);
      const targetUserId = target.rows[0]?.id ?? userId;

      if (targetUserId !== userId) {
        await client.query("UPDATE devices SET user_id = $1 WHERE user_id = $2", [targetUserId, userId]);
        await client.query("UPDATE lock_sessions SET user_id = $1 WHERE user_id = $2", [targetUserId, userId]);
        await client.query(
          `UPDATE users SET total_seconds = COALESCE((SELECT sum(credited_seconds) FROM lock_sessions WHERE user_id = $1), 0), updated_at = now()
           WHERE id = $1`,
          [targetUserId],
        );
        await client.query("DELETE FROM users WHERE id = $1", [userId]);
      } else {
        await client.query(
          `UPDATE users SET email_hash = $2, email_ciphertext = $3, email_masked = $4,
           email_verified_at = now(), updated_at = now() WHERE id = $1`,
          [userId, emailHash, encryptEmail(this.config, email), maskEmail(email)],
        );
      }
      await client.query("UPDATE email_otps SET consumed_at = now() WHERE id = $1", [otpId]);
      return targetUserId;
    });
  }

  async profile(userId: string): Promise<Profile | null> {
    const result = await this.pool.query<{
      id: string;
      email_ciphertext: string | null;
      email_masked: string | null;
      email_verified_at: Date | null;
      nickname: string;
      avatar_id: number;
      total_seconds: string;
      active_started_at: Date | null;
    }>(
      `WITH active AS (
         SELECT user_id, min(started_at) AS started_at
         FROM lock_sessions WHERE status = 'active' GROUP BY user_id
       )
       SELECT u.id, u.email_ciphertext, u.email_masked, u.email_verified_at, u.nickname, u.avatar_id, u.total_seconds,
         active.started_at AS active_started_at
       FROM users u LEFT JOIN active ON active.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email_ciphertext ? decryptEmail(this.config, row.email_ciphertext) : null,
      maskedEmail: row.email_masked,
      emailVerified: Boolean(row.email_verified_at),
      nickname: row.nickname,
      avatarId: row.avatar_id,
      totalSeconds: int(row.total_seconds),
      activeStartedAt: row.active_started_at?.toISOString() ?? null,
    };
  }

  async updateProfile(userId: string, input: {
    nickname?: string | undefined;
    avatarId?: number | undefined;
  }) {
    await this.pool.query(
      `UPDATE users SET nickname = COALESCE($2, nickname), avatar_id = COALESCE($3, avatar_id), updated_at = now()
       WHERE id = $1`,
      [userId, input.nickname ?? null, input.avatarId ?? null],
    );
    return this.profile(userId);
  }

  async deleteUser(userId: string) {
    await this.pool.query("DELETE FROM users WHERE id = $1", [userId]);
  }

  async startSession(input: {
    userId: string;
    deviceId: string;
    clientSessionId: string;
    idempotencyKey: string;
  }) {
    return transaction(this.pool, async (client) => {
      const existing = await client.query(
        `SELECT id, client_session_id, started_at FROM lock_sessions
         WHERE start_idempotency_key = $1 OR (device_id = $2 AND status = 'active')
         ORDER BY started_at DESC LIMIT 1`,
        [input.idempotencyKey, input.deviceId],
      );
      if (existing.rows[0]) return existing.rows[0] as { id: string; client_session_id: string; started_at: Date };
      const id = randomUUID();
      const result = await client.query<{ id: string; client_session_id: string; started_at: Date }>(
        `INSERT INTO lock_sessions(id, user_id, device_id, client_session_id, start_idempotency_key, status, source, started_at)
         VALUES ($1, $2, $3, $4, $5, 'active', 'online', now())
         RETURNING id, client_session_id, started_at`,
        [id, input.userId, input.deviceId, input.clientSessionId, input.idempotencyKey],
      );
      return result.rows[0]!;
    });
  }

  async stopSession(input: { userId: string; sessionId: string; idempotencyKey: string }) {
    return transaction(this.pool, async (client) => {
      const result = await client.query<{
        id: string;
        status: string;
        started_at: Date;
        ended_at: Date | null;
        credited_seconds: number;
        user_id: string;
        stop_idempotency_key: string | null;
      }>("SELECT * FROM lock_sessions WHERE id = $1 AND user_id = $2 FOR UPDATE", [input.sessionId, input.userId]);
      const session = result.rows[0];
      if (!session) throw new Error("SESSION_NOT_FOUND");
      if (session.status === "ended") {
        return { id: session.id, endedAt: session.ended_at!, creditedSeconds: session.credited_seconds };
      }
      const endedAt = new Date();
      const creditedSeconds = Math.max(0, Math.min(86_400, Math.floor((endedAt.getTime() - session.started_at.getTime()) / 1000)));
      await client.query(
        `UPDATE lock_sessions SET status = 'ended', ended_at = $2, credited_seconds = $3,
         stop_idempotency_key = $4, updated_at = now() WHERE id = $1`,
        [session.id, endedAt, creditedSeconds, input.idempotencyKey],
      );
      await client.query("UPDATE users SET total_seconds = total_seconds + $2, updated_at = now() WHERE id = $1", [input.userId, creditedSeconds]);
      return { id: session.id, endedAt, creditedSeconds };
    });
  }

  async reconcileSession(input: {
    userId: string;
    deviceId: string;
    clientSessionId: string;
    idempotencyKey: string;
    startedAt: Date;
    endedAt: Date;
  }) {
    return transaction(this.pool, async (client) => {
      const existing = await client.query<{ id: string; credited_seconds: number }>(
        "SELECT id, credited_seconds FROM lock_sessions WHERE client_session_id = $1 OR start_idempotency_key = $2",
        [input.clientSessionId, input.idempotencyKey],
      );
      if (existing.rows[0]) return { id: existing.rows[0].id, creditedSeconds: existing.rows[0].credited_seconds };
      const now = Date.now();
      const ended = Math.min(input.endedAt.getTime(), now + 60_000);
      const started = Math.min(input.startedAt.getTime(), ended);
      const creditedSeconds = Math.max(0, Math.min(86_400, Math.floor((ended - started) / 1000)));
      const id = randomUUID();
      await client.query(
        `INSERT INTO lock_sessions(id, user_id, device_id, client_session_id, start_idempotency_key,
         stop_idempotency_key, status, source, started_at, ended_at, credited_seconds)
         VALUES ($1, $2, $3, $4, $5, $5, 'ended', 'offline_reconcile', $6, $7, $8)`,
        [id, input.userId, input.deviceId, input.clientSessionId, input.idempotencyKey, new Date(started), new Date(ended), creditedSeconds],
      );
      await client.query("UPDATE users SET total_seconds = total_seconds + $2, updated_at = now() WHERE id = $1", [input.userId, creditedSeconds]);
      return { id, creditedSeconds };
    });
  }

  async rankForUser(userId: string) {
    const result = await this.pool.query<{ rank: string }>(
      `WITH active AS (
        SELECT user_id, min(started_at) AS started_at
        FROM lock_sessions WHERE status = 'active' GROUP BY user_id
      ), totals AS (
        SELECT users.id, users.total_seconds +
          COALESCE(EXTRACT(EPOCH FROM LEAST(now() - active.started_at, interval '24 hours')), 0)::bigint AS live_total
        FROM users LEFT JOIN active ON active.user_id = users.id
        WHERE email_verified_at IS NOT NULL AND public_visible = true
      )
      SELECT (1 + count(DISTINCT higher.live_total))::text AS rank
      FROM totals mine
      LEFT JOIN totals higher ON higher.live_total > mine.live_total
      WHERE mine.id = $1
      GROUP BY mine.id`,
      [userId],
    );
    return result.rows[0] ? int(result.rows[0].rank) : null;
  }

  async publicSnapshot(): Promise<PublicSnapshot> {
    const [leaders, sales] = await Promise.all([
      this.pool.query<{
        id: string;
        nickname: string;
        email_masked: string;
        avatar_id: number;
        total_seconds: string;
        active_started_at: Date | null;
      }>(
        `WITH active AS (
           SELECT user_id, min(started_at) AS started_at
           FROM lock_sessions WHERE status = 'active' GROUP BY user_id
         )
         SELECT u.id, u.nickname, u.email_masked, u.avatar_id, u.total_seconds,
           active.started_at AS active_started_at
         FROM users u LEFT JOIN active ON active.user_id = u.id
         WHERE u.email_verified_at IS NOT NULL AND u.public_visible = true
         ORDER BY u.total_seconds +
           COALESCE(EXTRACT(EPOCH FROM LEAST(now() - active.started_at, interval '24 hours')), 0) DESC
         LIMIT 100`,
      ),
      this.pool.query<{ gross: string; units: string; report_through: Date | string | null }>(
        `SELECT
           COALESCE((SELECT sum(gross_cny) FROM sales_daily), 0)::text AS gross,
           COALESCE((SELECT sum(units) FROM sales_daily), 0)::text AS units,
           (SELECT max(report_date) FROM sales_imports) AS report_through`,
      ),
    ]);
    const sale = sales.rows[0];
    return {
      asOf: new Date().toISOString(),
      sales: {
        grossCnyEstimate: Number.parseFloat(sale?.gross ?? "0") || 0,
        paidUnits: int(sale?.units),
        reportThrough: isoDate(sale?.report_through),
        estimated: true,
      },
      leaderboard: leaders.rows.map((row) => ({
        userId: row.id,
        nickname: row.nickname,
        maskedEmail: row.email_masked,
        avatarId: row.avatar_id,
        creditedSeconds: int(row.total_seconds),
        activeStartedAt: row.active_started_at?.toISOString() ?? null,
      })),
    };
  }

  async reportUser(input: { userId: string; reason: string; fingerprint: string }) {
    await this.pool.query(
      "INSERT INTO moderation_reports(id, reported_user_id, reason, reporter_fingerprint) VALUES ($1, $2, $3, $4)",
      [randomUUID(), input.userId, input.reason.slice(0, 500), input.fingerprint],
    );
  }

  async replaceSalesReport(reportDate: string, sha: string, rows: Array<{
    sourceKey: string;
    countryCode: string;
    currency: string;
    customerPrice: number;
    units: number;
    grossCny: number;
  }>) {
    await transaction(this.pool, async (client) => {
      const existing = await client.query<{ source_sha256: string }>("SELECT source_sha256 FROM sales_imports WHERE report_date = $1", [reportDate]);
      if (existing.rows[0]?.source_sha256 === sha) return;
      await client.query("DELETE FROM sales_daily WHERE report_date = $1", [reportDate]);
      for (const row of rows) {
        await client.query(
          `INSERT INTO sales_daily(source_key, report_date, country_code, customer_currency, customer_price, units, gross_cny)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [row.sourceKey, reportDate, row.countryCode, row.currency, row.customerPrice, row.units, row.grossCny],
        );
      }
      await client.query(
        `INSERT INTO sales_imports(report_date, source_sha256, row_count) VALUES ($1, $2, $3)
         ON CONFLICT(report_date) DO UPDATE SET source_sha256 = excluded.source_sha256,
         row_count = excluded.row_count, imported_at = now()`,
        [reportDate, sha, rows.length],
      );
    });
  }
}
