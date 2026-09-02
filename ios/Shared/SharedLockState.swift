import Foundation

struct SharedLockState: Codable, Equatable, Sendable {
    var isActive: Bool
    var clientSessionId: UUID
    var remoteSessionId: UUID?
    var startedAt: Date
    var selectedAmbientId: String
    var selectedBackgroundId: String
    var audioEnabled: Bool
    var updatedAt: Date
}

struct CompletedLocalSession: Codable, Equatable, Identifiable, Sendable {
    var id: UUID { clientSessionId }
    var clientSessionId: UUID
    var remoteSessionId: UUID?
    var startedAt: Date
    var endedAt: Date
    var stopIdempotencyKey: String
}

final class SharedStateStore: @unchecked Sendable {
    static let shared = SharedStateStore()
    private let defaults: UserDefaults?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults? = UserDefaults(suiteName: LockYourConstants.appGroupIdentifier)) {
        self.defaults = defaults
    }

    func load() -> SharedLockState? {
        guard let data = defaults?.data(forKey: LockYourConstants.sharedStateKey) else { return nil }
        return try? decoder.decode(SharedLockState.self, from: data)
    }

    func save(_ state: SharedLockState) {
        guard let data = try? encoder.encode(state) else { return }
        defaults?.set(data, forKey: LockYourConstants.sharedStateKey)
    }

    func clear() {
        defaults?.removeObject(forKey: LockYourConstants.sharedStateKey)
    }

    func completedSessions() -> [CompletedLocalSession] {
        guard let data = defaults?.data(forKey: LockYourConstants.pendingSessionsKey) else { return [] }
        return (try? decoder.decode([CompletedLocalSession].self, from: data)) ?? []
    }

    func replaceCompletedSessions(_ sessions: [CompletedLocalSession]) {
        guard let data = try? encoder.encode(sessions) else { return }
        defaults?.set(data, forKey: LockYourConstants.pendingSessionsKey)
    }
}
