import CryptoKit
import DeviceCheck
import Foundation

enum AppAttestError: Error {
    case unsupported
    case missingKey
}

final class AppAttestClient: @unchecked Sendable {
    static let shared = AppAttestClient()
    private let service = DCAppAttestService.shared

    var isSupported: Bool { service.isSupported }

    func generateKey() async throws -> String {
        guard service.isSupported else { throw AppAttestError.unsupported }
        return try await withCheckedThrowingContinuation { continuation in
            service.generateKey { keyId, error in
                if let keyId { continuation.resume(returning: keyId) }
                else { continuation.resume(throwing: error ?? AppAttestError.missingKey) }
            }
        }
    }

    func attestation(keyId: String, challenge: String) async throws -> Data {
        let hash = Data(SHA256.hash(data: Data(challenge.utf8)))
        return try await withCheckedThrowingContinuation { continuation in
            service.attestKey(keyId, clientDataHash: hash) { data, error in
                if let data { continuation.resume(returning: data) }
                else { continuation.resume(throwing: error ?? AppAttestError.missingKey) }
            }
        }
    }

    func assertion(keyId: String, challenge: String) async throws -> Data {
        let hash = Data(SHA256.hash(data: Data(challenge.utf8)))
        return try await withCheckedThrowingContinuation { continuation in
            service.generateAssertion(keyId, clientDataHash: hash) { data, error in
                if let data { continuation.resume(returning: data) }
                else { continuation.resume(throwing: error ?? AppAttestError.missingKey) }
            }
        }
    }
}
