import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { importPKCS8, SignJWT } from "jose";
import type { Config } from "./config.js";
import type { Database } from "./database.js";

type RawSalesRow = Record<string, string>;

function reportDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseTSV(source: string) {
  const lines = source.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = lines.shift()?.split("\t") ?? [];
  return lines.filter(Boolean).map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) as RawSalesRow;
  });
}

class FxRates {
  private readonly cache = new Map<string, number>();

  async cnyPerUnit(currency: string, date: string) {
    if (currency === "CNY") return 1;
    const key = `${date}:${currency}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const response = await fetch(`https://api.frankfurter.app/${date}?from=${encodeURIComponent(currency)}&to=CNY`);
    if (!response.ok) throw new Error(`FX rate unavailable for ${currency} on ${date}`);
    const body = await response.json() as { rates?: { CNY?: number } };
    const rate = body.rates?.CNY;
    if (!rate || rate <= 0) throw new Error(`Invalid FX rate for ${currency}`);
    this.cache.set(key, rate);
    return rate;
  }
}

export class AppleSalesImporter {
  private readonly rates = new FxRates();

  constructor(private readonly config: Config, private readonly database: Database) {}

  get configured() {
    return Boolean(
      this.config.APPLE_ISSUER_ID &&
      this.config.APPLE_KEY_ID &&
      this.config.APPLE_PRIVATE_KEY_BASE64 &&
      this.config.APPLE_VENDOR_NUMBER &&
      this.config.APPLE_APP_ID
    );
  }

  private async token() {
    const privateKey = Buffer.from(this.config.APPLE_PRIVATE_KEY_BASE64!, "base64").toString("utf8");
    const key = await importPKCS8(privateKey, "ES256");
    return new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: this.config.APPLE_KEY_ID!, typ: "JWT" })
      .setIssuer(this.config.APPLE_ISSUER_ID!)
      .setAudience("appstoreconnect-v1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(key);
  }

  async importDay(day: Date) {
    if (!this.configured) return false;
    const date = reportDate(day);
    const parameters = new URLSearchParams({
      "filter[frequency]": "DAILY",
      "filter[reportDate]": date,
      "filter[reportSubType]": "SUMMARY",
      "filter[reportType]": "SALES",
      "filter[vendorNumber]": this.config.APPLE_VENDOR_NUMBER!,
      "filter[version]": "1_0",
    });
    const response = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${parameters}`, {
      headers: { Authorization: `Bearer ${await this.token()}`, Accept: "application/a-gzip" },
    });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Apple sales report failed with HTTP ${response.status}`);
    const compressed = Buffer.from(await response.arrayBuffer());
    const data = gunzipSync(compressed);
    const sha = createHash("sha256").update(data).digest("hex");
    const parsed = parseTSV(data.toString("utf8"));
    const rows = [];
    for (let index = 0; index < parsed.length; index += 1) {
      const row = parsed[index]!;
      if (row["Apple Identifier"] !== this.config.APPLE_APP_ID) continue;
      const units = Number.parseInt(row.Units ?? "0", 10) || 0;
      const price = Number.parseFloat(row["Customer Price"] ?? "0") || 0;
      const currency = row["Customer Currency"] || "CNY";
      const country = row["Country Code"] || "ZZ";
      const rate = await this.rates.cnyPerUnit(currency, date);
      rows.push({
        sourceKey: `${date}:${country}:${currency}:${price}:${row["Apple Identifier"] ?? "app"}:${index}`,
        countryCode: country,
        currency,
        customerPrice: price,
        units,
        grossCny: price * units * rate,
      });
    }
    await this.database.replaceSalesReport(date, sha, rows);
    return true;
  }

  async importLatest() {
    if (!this.configured) return false;
    let changed = false;
    for (let offset = 1; offset <= 7; offset += 1) {
      const date = new Date(Date.now() - offset * 86_400_000);
      changed = (await this.importDay(date)) || changed;
    }
    return changed;
  }
}
