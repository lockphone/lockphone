import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1),
  PUBLIC_WEB_ORIGINS: z.string().default("http://localhost:3000"),
  AUTH_JWT_SECRET: z.string().min(32),
  EMAIL_HASH_SECRET: z.string().min(32),
  EMAIL_ENCRYPTION_KEY_BASE64: z.string().min(40),
  OTP_SECRET: z.string().min(32),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
  CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().default("verify@lockyourphone.app"),
  APP_ATTEST_MODE: z.enum(["disabled", "development", "production"]).default("development"),
  APPLE_TEAM_ID: z.string().default("V6MKVNS45G"),
  APPLE_BUNDLE_ID: z.string().default("www.coreader.studio.lockyour"),
  APPLE_ISSUER_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY_BASE64: z.string().optional(),
  APPLE_VENDOR_NUMBER: z.string().optional(),
  APPLE_APP_ID: z.string().regex(/^\d+$/).optional(),
  APPLE_SALES_START_DATE: z.string().optional(),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Invalid configuration: ${details}`);
  }
  const encryptionKey = Buffer.from(parsed.data.EMAIL_ENCRYPTION_KEY_BASE64, "base64");
  if (encryptionKey.length !== 32) throw new Error("EMAIL_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes");
  return parsed.data;
}

export function webOrigins(config: Config) {
  return config.PUBLIC_WEB_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
}
