import Foundation

enum APIClientError: LocalizedError {
    case invalidConfiguration
    case notRegistered
    case server(String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration: return "API base URL is invalid."
        case .notRegistered: return "This device is not registered."
        case .server(let code): return code
        case .invalidResponse: return "The server returned an invalid response."
        }
    }
}

private struct TokenEnvelope: Decodable {
    var userId: UUID?
    var deviceId: UUID?
    let accessToken: String
    let accessExpiresIn: Int
    let refreshToken: String
    let refreshExpiresAt: Date
}

private struct ChallengeEnvelope: Decodable { let challenge: String }
private struct RemoteSession: Decodable {
    let id: UUID
    let clientSessionId: UUID
    let startedAt: Date
}

actor APIClient {
    static let shared = APIClient()

    private let identityStore = IdentityStore.shared
    private let appAttest = AppAttestClient.shared
    private var credentials: CredentialState
    private let baseURL: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init() {
        credentials = IdentityStore.shared.load()
        let configured = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
        baseURL = URL(string: configured ?? "http://localhost:8080") ?? URL(string: "http://localhost:8080")!
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    func bootstrap() async throws {
        try await ensureRegistered()
        if appAttest.isSupported, credentials.appAttestKeyId == nil {
            try? await enrollAppAttest()
        }
    }

    func profile() async throws -> AccountProfile {
        try await ensureRegistered()
        let data = try await send(method: "GET", path: "/v1/me", authenticated: true)
        return try decoder.decode(AccountProfile.self, from: data)
    }

    func stats() async throws -> AccountStats {
        try await ensureRegistered()
        let data = try await send(method: "GET", path: "/v1/me/stats", authenticated: true)
        return try decoder.decode(AccountStats.self, from: data)
    }

    func requestEmailCode(email: String) async throws {
        try await ensureRegistered()
        _ = try await send(
            method: "POST",
            path: "/v1/auth/email/request",
            body: ["email": email, "locale": Locale.preferredLanguages.first ?? "en"],
            authenticated: true
        )
    }

    func verifyEmail(email: String, code: String) async throws -> AccountProfile {
        try await ensureRegistered()
        let data = try await send(
            method: "POST",
            path: "/v1/auth/email/verify",
            body: ["email": email, "code": code],
            authenticated: true,
            sensitive: true
        )
        let tokens = try decoder.decode(TokenEnvelope.self, from: data)
        apply(tokens)
        return try await profile()
    }

    func updateProfile(nickname: String? = nil, avatarId: Int? = nil) async throws -> AccountProfile {
        try await ensureRegistered()
        var body: [String: Any] = [:]
        if let nickname { body["nickname"] = nickname }
        if let avatarId { body["avatarId"] = avatarId }
        let data = try await send(method: "PATCH", path: "/v1/me", body: body, authenticated: true)
        return try decoder.decode(AccountProfile.self, from: data)
    }

    func startSession(clientSessionId: UUID) async throws -> UUID {
        try await ensureRegistered()
        let data = try await send(
            method: "POST",
            path: "/v1/sessions/start",
            body: ["clientSessionId": clientSessionId.uuidString],
            authenticated: true,
            sensitive: true,
            idempotencyKey: "start-\(clientSessionId.uuidString.lowercased())"
        )
        return try decoder.decode(RemoteSession.self, from: data).id
    }

    func stopSession(remoteId: UUID, idempotencyKey: String) async throws {
        try await ensureRegistered()
        _ = try await send(
            method: "POST",
            path: "/v1/sessions/\(remoteId.uuidString)/stop",
            authenticated: true,
            sensitive: true,
            idempotencyKey: idempotencyKey
        )
    }

    func reconcile(_ session: CompletedLocalSession) async throws {
        try await ensureRegistered()
        _ = try await send(
            method: "POST",
            path: "/v1/sessions/reconcile",
            body: [
                "clientSessionId": session.clientSessionId.uuidString,
                "startedAt": ISO8601DateFormatter().string(from: session.startedAt),
                "endedAt": ISO8601DateFormatter().string(from: session.endedAt)
            ],
            authenticated: true,
            sensitive: true,
            idempotencyKey: session.stopIdempotencyKey
        )
    }

    func deleteAccount() async throws {
        try await ensureRegistered()
        _ = try await send(method: "DELETE", path: "/v1/me", authenticated: true, sensitive: true)
        credentials = identityStore.reset()
    }

    func signOutDevice() async throws {
        try await ensureRegistered()
        _ = try await send(method: "DELETE", path: "/v1/devices/current", authenticated: true)
        credentials = identityStore.reset()
    }

    private func ensureRegistered() async throws {
        if let expiry = credentials.accessExpiresAt,
           expiry > Date().addingTimeInterval(60),
           credentials.accessToken != nil { return }
        if credentials.refreshToken != nil {
            do {
                try await refresh()
                return
            } catch {
                credentials.accessToken = nil
                credentials.refreshToken = nil
                identityStore.save(credentials)
            }
        }
        let data = try await send(
            method: "POST",
            path: "/v1/devices/register",
            body: [
                "installId": credentials.installId.uuidString,
                "deviceSecret": credentials.deviceSecret,
                "locale": Locale.preferredLanguages.first ?? "en"
            ]
        )
        apply(try decoder.decode(TokenEnvelope.self, from: data))
    }

    private func refresh() async throws {
        guard let refreshToken = credentials.refreshToken else { throw APIClientError.notRegistered }
        let data = try await send(method: "POST", path: "/v1/auth/refresh", body: ["refreshToken": refreshToken])
        apply(try decoder.decode(TokenEnvelope.self, from: data))
    }

    private func apply(_ tokens: TokenEnvelope) {
        credentials.userId = tokens.userId ?? credentials.userId
        credentials.deviceId = tokens.deviceId ?? credentials.deviceId
        credentials.accessToken = tokens.accessToken
        credentials.accessExpiresAt = Date().addingTimeInterval(TimeInterval(tokens.accessExpiresIn))
        credentials.refreshToken = tokens.refreshToken
        credentials.refreshExpiresAt = tokens.refreshExpiresAt
        identityStore.save(credentials)
    }

    private func enrollAppAttest() async throws {
        guard appAttest.isSupported else { return }
        let keyId = try await appAttest.generateKey()
        let challenge = try await challenge()
        let attestation = try await appAttest.attestation(keyId: keyId, challenge: challenge)
        _ = try await send(
            method: "POST",
            path: "/v1/attest/verify",
            body: ["challenge": challenge, "keyId": keyId, "attestation": attestation.base64EncodedString()],
            authenticated: true
        )
        credentials.appAttestKeyId = keyId
        identityStore.save(credentials)
    }

    private func challenge() async throws -> String {
        let data = try await send(method: "POST", path: "/v1/attest/challenge", authenticated: true)
        return try decoder.decode(ChallengeEnvelope.self, from: data).challenge
    }

    private func assertionHeaders() async -> [String: String] {
        guard let keyId = credentials.appAttestKeyId else { return [:] }
        do {
            let challenge = try await challenge()
            let assertion = try await appAttest.assertion(keyId: keyId, challenge: challenge)
            return [
                "X-App-Attest-Challenge": challenge,
                "X-App-Attest-Key-Id": keyId,
                "X-App-Attest-Assertion": assertion.base64EncodedString()
            ]
        } catch {
            return [:]
        }
    }

    private func send(
        method: String,
        path: String,
        body: [String: Any]? = nil,
        authenticated: Bool = false,
        sensitive: Bool = false,
        idempotencyKey: String? = nil
    ) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw APIClientError.invalidConfiguration }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if authenticated {
            guard let token = credentials.accessToken else { throw APIClientError.notRegistered }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let idempotencyKey { request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key") }
        if sensitive {
            for (name, value) in await assertionHeaders() { request.setValue(value, forHTTPHeaderField: name) }
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw APIClientError.server(object?["error"] as? String ?? "HTTP_\(http.statusCode)")
        }
        return data
    }
}
