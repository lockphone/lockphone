import Foundation
import Security

struct CredentialState: Codable, Sendable {
    var installId: UUID
    var deviceSecret: String
    var userId: UUID?
    var deviceId: UUID?
    var accessToken: String?
    var accessExpiresAt: Date?
    var refreshToken: String?
    var refreshExpiresAt: Date?
    var appAttestKeyId: String?

    static func fresh() -> CredentialState {
        var random = Data(count: 32)
        _ = random.withUnsafeMutableBytes { bytes in
            SecRandomCopyBytes(kSecRandomDefault, 32, bytes.baseAddress!)
        }
        return .init(
            installId: UUID(),
            deviceSecret: random.base64EncodedString(),
            userId: nil,
            deviceId: nil,
            accessToken: nil,
            accessExpiresAt: nil,
            refreshToken: nil,
            refreshExpiresAt: nil,
            appAttestKeyId: nil
        )
    }
}

final class IdentityStore: @unchecked Sendable {
    static let shared = IdentityStore()
    private let service = "www.coreader.studio.lockyour.identity"
    private let account = "device"
    private let pendingVerificationAccount = "pending-email-verification"

    func load() -> CredentialState {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data,
           let value = try? JSONDecoder().decode(CredentialState.self, from: data) {
            return value
        }
        let value = CredentialState.fresh()
        save(value)
        return value
    }

    func save(_ value: CredentialState) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let attributes = [kSecValueData as String: data]
        if SecItemUpdate(query as CFDictionary, attributes as CFDictionary) == errSecItemNotFound {
            var insertion = query
            insertion[kSecValueData as String] = data
            insertion[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(insertion as CFDictionary, nil)
        }
    }

    func reset() -> CredentialState {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
        clearPendingVerificationEmail()
        let value = CredentialState.fresh()
        save(value)
        return value
    }

    func pendingVerificationEmail() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: pendingVerificationAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let email = String(data: data, encoding: .utf8),
              !email.isEmpty else { return nil }
        return email
    }

    func savePendingVerificationEmail(_ email: String) {
        guard let data = email.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: pendingVerificationAccount
        ]
        let attributes = [kSecValueData as String: data]
        if SecItemUpdate(query as CFDictionary, attributes as CFDictionary) == errSecItemNotFound {
            var insertion = query
            insertion[kSecValueData as String] = data
            insertion[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(insertion as CFDictionary, nil)
        }
    }

    func clearPendingVerificationEmail() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: pendingVerificationAccount
        ]
        SecItemDelete(query as CFDictionary)
    }
}
