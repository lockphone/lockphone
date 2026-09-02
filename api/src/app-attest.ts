import { verifyAssertion, verifyAttestation } from "node-app-attest";
import type { Config } from "./config.js";
import type { Database } from "./database.js";
import type { AuthContext } from "./types.js";

export class AppAttestService {
  constructor(private readonly config: Config, private readonly database: Database) {}

  async issueChallenge(auth: AuthContext, challenge: string) {
    await this.database.createAttestChallenge(auth.deviceId, challenge);
  }

  async verifyKey(input: AuthContext & { challenge: string; keyId: string; attestation: string }) {
    const validChallenge = await this.database.consumeAttestChallenge(input.deviceId, input.challenge);
    if (!validChallenge) throw new Error("APP_ATTEST_CHALLENGE_INVALID");
    const result = verifyAttestation({
      attestation: Buffer.from(input.attestation, "base64"),
      challenge: input.challenge,
      keyId: input.keyId,
      bundleIdentifier: this.config.APPLE_BUNDLE_ID,
      teamIdentifier: this.config.APPLE_TEAM_ID,
      allowDevelopmentEnvironment: this.config.APP_ATTEST_MODE !== "production",
    });
    await this.database.saveAttestation(input.deviceId, result.keyId, result.publicKey);
  }

  async verifyAssertion(input: AuthContext & {
    challenge?: string | undefined;
    keyId?: string | undefined;
    assertion?: string | undefined;
  }) {
    if (this.config.APP_ATTEST_MODE === "disabled") return;
    if (!input.challenge || !input.keyId || !input.assertion) {
      if (this.config.APP_ATTEST_MODE === "development") return;
      throw new Error("APP_ATTEST_REQUIRED");
    }
    const validChallenge = await this.database.consumeAttestChallenge(input.deviceId, input.challenge);
    if (!validChallenge) throw new Error("APP_ATTEST_CHALLENGE_INVALID");
    const stored = await this.database.attestation(input.deviceId, input.keyId);
    if (!stored) throw new Error("APP_ATTEST_KEY_UNKNOWN");
    const result = verifyAssertion({
      assertion: Buffer.from(input.assertion, "base64"),
      payload: input.challenge,
      publicKey: stored.publicKey,
      bundleIdentifier: this.config.APPLE_BUNDLE_ID,
      teamIdentifier: this.config.APPLE_TEAM_ID,
      signCount: stored.counter,
    });
    await this.database.updateAttestationCounter(input.deviceId, input.keyId, result.signCount);
  }
}
