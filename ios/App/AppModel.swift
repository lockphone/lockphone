import FamilyControls
import Foundation
import UIKit

struct SessionResult: Identifiable, Equatable {
    let id = UUID()
    let startedAt: Date
    let endedAt: Date
    var duration: Int { max(0, Int(endedAt.timeIntervalSince(startedAt))) }
}

@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var authorizationStatus: AuthorizationStatus
    @Published private(set) var activeSession: SharedLockState?
    @Published private(set) var whitelistSelection: FamilyActivitySelection
    @Published private(set) var profile: AccountProfile?
    @Published private(set) var stats: AccountStats?
    @Published var scene: ScenePreset
    @Published var audioEnabled: Bool
    @Published var accountError: String?
    @Published var isAccountLoading = false
    @Published var authorizationError: String?
    @Published var result: SessionResult?
    @Published private(set) var pendingVerificationEmail: String?
    @Published private(set) var emailVerificationReturnRequested = false

    let audioPlayer = AmbientAudioPlayer()
    private let lockingService = LockingService()
    private let liveActivity = LiveActivityManager()
    private let api = APIClient.shared
    private let identityStore = IdentityStore.shared
    private let defaults = UserDefaults(suiteName: LockYourConstants.appGroupIdentifier)
    private var didBootstrap = false

#if DEBUG
    private static var screenshotModeEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains("-LockYourScreenshotMode") ||
            ProcessInfo.processInfo.environment["LOCK_YOUR_SCREENSHOT_MODE"] == "1"
    }
#endif

    var screenshotScreen: String? {
#if DEBUG
        Self.screenshotModeEnabled
            ? ProcessInfo.processInfo.environment["LOCK_YOUR_SCREENSHOT_SCREEN"] ?? "lock"
            : nil
#else
        nil
#endif
    }

    init() {
        pendingVerificationEmail = identityStore.pendingVerificationEmail()
#if DEBUG
        if Self.screenshotModeEnabled {
            authorizationStatus = .approved
            whitelistSelection = FamilyActivitySelection(includeEntireCategory: false)
            scene = .preset(id: "cafe-corner")
            audioEnabled = true
            activeSession = SharedLockState(
                isActive: true,
                clientSessionId: UUID(uuidString: "8B201E17-7E78-4E63-9615-2DDAF824725C")!,
                remoteSessionId: nil,
                startedAt: Date().addingTimeInterval(-5_025),
                selectedAmbientId: "cafe-corner",
                selectedBackgroundId: "cafe-corner",
                audioEnabled: true,
                updatedAt: .now
            )
            profile = AccountProfile(
                id: UUID(uuidString: "BD98BD0D-4610-4E45-A01D-36E3A9796273")!,
                email: "focus@example.com",
                maskedEmail: "fo***@example.com",
                emailVerified: true,
                nickname: AppCopy.text(zh: "专注中的你", en: "Focused you"),
                avatarId: 47,
                totalSeconds: 18_540,
                activeStartedAt: activeSession?.startedAt
            )
            stats = AccountStats(totalSeconds: 18_540, activeStartedAt: activeSession?.startedAt, rank: 12)
            return
        }
#endif
        authorizationStatus = AuthorizationCenter.shared.authorizationStatus
        whitelistSelection = SharedWhitelistStore.shared.load()
        let savedScene = UserDefaults(suiteName: LockYourConstants.appGroupIdentifier)?.string(forKey: "lock_your.scene")
        scene = ScenePreset.preset(id: savedScene)
        audioEnabled = UserDefaults(suiteName: LockYourConstants.appGroupIdentifier)?.object(forKey: "lock_your.audio_enabled") as? Bool ?? true
        activeSession = SharedStateStore.shared.load()
    }

    var isAuthorized: Bool { authorizationStatus == .approved }
    var hasWhitelist: Bool { !whitelistSelection.applicationTokens.isEmpty }
    var canChooseWhitelist: Bool { activeSession != nil && !hasWhitelist }

    func bootstrap() async {
#if DEBUG
        if Self.screenshotModeEnabled {
            didBootstrap = true
            return
        }
#endif
        guard !didBootstrap else { return }
        didBootstrap = true
        await refreshAuthorization()
        guard isAuthorized else { return }

        if let stored = SharedStateStore.shared.load(), stored.isActive,
           Date().timeIntervalSince(stored.startedAt) < 86_400 {
            activeSession = stored
            scene = ScenePreset.preset(id: stored.selectedBackgroundId)
            audioEnabled = stored.audioEnabled
            restoreRuntime(for: stored)
        } else {
            if let expired = SharedStateStore.shared.load(), expired.isActive {
                finishLocally(expired, endedAt: min(Date(), expired.startedAt.addingTimeInterval(86_400)), showResult: false)
            }
            startNewSession()
        }

        Task {
            try? await api.bootstrap()
            await connectRemoteSessionIfFresh()
            await syncCompletedSessions()
            await refreshAccount()
        }
    }

    func refreshAuthorization() async {
        let next = lockingService.authorizationStatus
        authorizationStatus = next
        if next != .approved, let session = activeSession {
            finishLocally(session, endedAt: .now, showResult: false)
        }
    }

    func requestAuthorization() async {
        authorizationError = nil
        do {
            try await lockingService.requestAuthorization()
            authorizationStatus = lockingService.authorizationStatus
            if isAuthorized { startNewSession() }
        } catch {
            authorizationStatus = lockingService.authorizationStatus
            authorizationError = AppCopy.text(
                zh: "没有获得屏幕使用权限。请在系统设置中允许后再回来。",
                en: "Screen Time access was not granted. Allow it in Settings, then come back."
            )
        }
    }

    func startNewSession() {
        guard isAuthorized, activeSession == nil else { return }
        let state = SharedLockState(
            isActive: true,
            clientSessionId: UUID(),
            remoteSessionId: nil,
            startedAt: .now,
            selectedAmbientId: scene.id,
            selectedBackgroundId: scene.id,
            audioEnabled: audioEnabled,
            updatedAt: .now
        )
        activeSession = state
        SharedStateStore.shared.save(state)
        result = nil
        restoreRuntime(for: state)
        Task {
            try? await api.bootstrap()
            await connectRemoteSessionIfFresh()
            await syncCompletedSessions()
        }
    }

    func endSession() {
        guard let session = activeSession else { return }
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
        finishLocally(session, endedAt: .now, showResult: true)
        Task {
            await syncCompletedSessions()
            await refreshAccount()
        }
    }

    func chooseScene(_ next: ScenePreset) {
        scene = next
        defaults?.set(next.id, forKey: "lock_your.scene")
        if audioEnabled { audioPlayer.play(scene: next) }
        if var session = activeSession {
            session.selectedAmbientId = next.id
            session.selectedBackgroundId = next.id
            session.updatedAt = .now
            activeSession = session
            SharedStateStore.shared.save(session)
            liveActivity.update(scene: next, audioEnabled: audioEnabled)
        }
    }

    func toggleAudio() {
        audioEnabled.toggle()
        defaults?.set(audioEnabled, forKey: "lock_your.audio_enabled")
        if audioEnabled, activeSession != nil { audioPlayer.play(scene: scene) }
        else { audioPlayer.stop() }
        if var session = activeSession {
            session.audioEnabled = audioEnabled
            session.updatedAt = .now
            activeSession = session
            SharedStateStore.shared.save(session)
            liveActivity.update(scene: scene, audioEnabled: audioEnabled)
        }
    }

    func saveWhitelist(_ selection: FamilyActivitySelection) throws {
        guard canChooseWhitelist else { return }
        try SharedWhitelistStore.shared.save(selection)
        whitelistSelection = SharedWhitelistStore.shared.load()
        lockingService.applyShield()
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    func refreshAccount() async {
#if DEBUG
        if Self.screenshotModeEnabled { return }
#endif
        isAccountLoading = true
        defer { isAccountLoading = false }
        do {
            try await api.bootstrap()
            async let nextProfile = api.profile()
            async let nextStats = api.stats()
            profile = try await nextProfile
            stats = try await nextStats
            accountError = nil
        } catch {
            accountError = AppCopy.text(zh: "暂时无法连接服务器，本地锁机不受影响。", en: "The server is unavailable. Local locking still works.")
        }
    }

    func requestEmailCode(_ email: String) async -> Bool {
        isAccountLoading = true
        defer { isAccountLoading = false }
        do {
            try await api.requestEmailCode(email: email)
            let verifiedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            identityStore.savePendingVerificationEmail(verifiedEmail)
            pendingVerificationEmail = verifiedEmail
            accountError = nil
            return true
        } catch {
            accountError = localizedAccountError(error)
            return false
        }
    }

    func verifyEmail(_ email: String, code: String) async -> Bool {
        isAccountLoading = true
        defer { isAccountLoading = false }
        do {
            profile = try await api.verifyEmail(email: email, code: code)
            stats = try await api.stats()
            identityStore.clearPendingVerificationEmail()
            pendingVerificationEmail = nil
            accountError = nil
            return true
        } catch {
            accountError = localizedAccountError(error)
            return false
        }
    }

    func updateProfile(nickname: String? = nil, avatarId: Int? = nil) async {
        isAccountLoading = true
        defer { isAccountLoading = false }
        do {
            profile = try await api.updateProfile(nickname: nickname, avatarId: avatarId)
            accountError = nil
        } catch {
            accountError = localizedAccountError(error)
        }
    }

    func removeAccount(deleteEverywhere: Bool) async -> Bool {
        isAccountLoading = true
        defer { isAccountLoading = false }
        if let session = activeSession { finishLocally(session, endedAt: .now, showResult: false) }
        do {
            if deleteEverywhere { try await api.deleteAccount() }
            else { try await api.signOutDevice() }
            profile = nil
            stats = nil
            try await api.bootstrap()
            await refreshAccount()
            if isAuthorized { startNewSession() }
            return true
        } catch {
            accountError = localizedAccountError(error)
            return false
        }
    }

    func appBecameActive() async {
#if DEBUG
        if Self.screenshotModeEnabled { return }
#endif
        let wasAuthorized = isAuthorized
        await refreshAuthorization()
        if !wasAuthorized, isAuthorized, activeSession == nil { startNewSession() }
        if isAuthorized, activeSession != nil {
            lockingService.applyShield()
            await syncCompletedSessions()
        }
    }

    func handleOpenURL(_ url: URL) {
        guard url.scheme?.lowercased() == "lockphone",
              url.host?.lowercased() == "verify-email" else { return }
        emailVerificationReturnRequested = true
        accountError = nil
    }

    func consumeEmailVerificationReturn() {
        emailVerificationReturnRequested = false
    }

    private func restoreRuntime(for state: SharedLockState) {
        lockingService.applyShield()
        if state.audioEnabled { audioPlayer.play(scene: scene) }
        else { audioPlayer.stop() }
        liveActivity.start(
            sessionId: state.clientSessionId,
            startedAt: state.startedAt,
            scene: scene,
            audioEnabled: state.audioEnabled
        )
    }

    private func finishLocally(_ session: SharedLockState, endedAt: Date, showResult: Bool) {
        let end = min(endedAt, session.startedAt.addingTimeInterval(86_400))
        let completed = CompletedLocalSession(
            clientSessionId: session.clientSessionId,
            remoteSessionId: session.remoteSessionId,
            startedAt: session.startedAt,
            endedAt: max(session.startedAt, end),
            stopIdempotencyKey: "stop-\(session.clientSessionId.uuidString.lowercased())"
        )
        var pending = SharedStateStore.shared.completedSessions()
        if !pending.contains(where: { $0.clientSessionId == completed.clientSessionId }) { pending.append(completed) }
        SharedStateStore.shared.replaceCompletedSessions(pending)
        SharedStateStore.shared.clear()
        activeSession = nil
        lockingService.clearShield()
        audioPlayer.stop()
        liveActivity.end()
        if showResult { result = SessionResult(startedAt: session.startedAt, endedAt: completed.endedAt) }
    }

    private func connectRemoteSessionIfFresh() async {
        guard let session = activeSession,
              session.remoteSessionId == nil,
              Date().timeIntervalSince(session.startedAt) < 60 else { return }
        do {
            let remoteId = try await api.startSession(clientSessionId: session.clientSessionId)
            if var current = activeSession, current.clientSessionId == session.clientSessionId {
                current.remoteSessionId = remoteId
                current.updatedAt = .now
                activeSession = current
                SharedStateStore.shared.save(current)
            } else {
                var pending = SharedStateStore.shared.completedSessions()
                if let index = pending.firstIndex(where: { $0.clientSessionId == session.clientSessionId }) {
                    pending[index].remoteSessionId = remoteId
                    SharedStateStore.shared.replaceCompletedSessions(pending)
                    await syncCompletedSessions()
                }
            }
        } catch {
            // The completed session will be reconciled when connectivity returns.
        }
    }

    private func syncCompletedSessions() async {
        var remaining: [CompletedLocalSession] = []
        for session in SharedStateStore.shared.completedSessions() {
            do {
                if let remoteId = session.remoteSessionId {
                    try await api.stopSession(remoteId: remoteId, idempotencyKey: session.stopIdempotencyKey)
                } else {
                    try await api.reconcile(session)
                }
            } catch {
                remaining.append(session)
            }
        }
        SharedStateStore.shared.replaceCompletedSessions(remaining)
    }

    private func localizedAccountError(_ error: Error) -> String {
        if let apiError = error as? APIClientError {
            switch apiError {
            case .server("OTP_INVALID"), .server("OTP_EXPIRED"):
                return AppCopy.text(zh: "验证码不正确或已过期。", en: "That code is invalid or expired.")
            case .server("OTP_RATE_LIMITED"):
                return AppCopy.text(zh: "请求太频繁，请稍后再试。", en: "Too many requests. Try again later.")
            default:
                break
            }
        }
        return AppCopy.text(zh: "操作失败，请检查网络后重试。", en: "That did not work. Check your connection and try again.")
    }
}
