import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { AppleSalesImporter } from "../src/apple-sales.js";
import type { Config } from "../src/config.js";
import type { Database } from "../src/database.js";

test("sales importer sends Apple's dashed report date and keeps only Lock Your rows", async () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const config = {
    APPLE_ISSUER_ID: "4478bf73-edcc-4df4-869c-3326b3e084b7",
    APPLE_KEY_ID: "Y9JUNU9J36",
    APPLE_PRIVATE_KEY_BASE64: Buffer.from(privateKeyPem).toString("base64"),
    APPLE_VENDOR_NUMBER: "93760155",
    APPLE_APP_ID: "6807374179",
  } as Config;

  const imported: Array<{ reportDate: string; rows: Array<{ units: number; grossCny: number }> }> = [];
  const database = {
    async replaceSalesReport(reportDate: string, _sha: string, rows: Array<{ units: number; grossCny: number }>) {
      imported.push({ reportDate, rows });
    },
  } as unknown as Database;

  const report = [
    "Apple Identifier\tUnits\tCustomer Price\tCustomer Currency\tCountry Code",
    "6807374179\t2\t1.99\tCNY\tCN",
    "1234567890\t99\t99.00\tCNY\tUS",
  ].join("\n");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("filter[reportDate]"), "2026-08-31");
    assert.equal(url.searchParams.get("filter[vendorNumber]"), "93760155");
    return new Response(gzipSync(Buffer.from(report)), { status: 200 });
  };

  try {
    const importer = new AppleSalesImporter(config, database);
    assert.equal(importer.configured, true);
    assert.equal(await importer.importDay(new Date("2026-08-31T12:00:00Z")), true);
    assert.equal(imported.length, 1);
    assert.equal(imported[0]?.reportDate, "2026-08-31");
    assert.deepEqual(imported[0]?.rows, [{
      sourceKey: "2026-08-31:CN:CNY:1.99:6807374179:0",
      countryCode: "CN",
      currency: "CNY",
      customerPrice: 1.99,
      units: 2,
      grossCny: 3.98,
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
