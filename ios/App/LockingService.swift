import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

@MainActor
final class LockingService {
    private let authorizationCenter = AuthorizationCenter.shared
    private let managedStore = ManagedSettingsStore(named: LockYourConstants.managedStoreName)
    private let activityCenter = DeviceActivityCenter()

    var authorizationStatus: AuthorizationStatus { authorizationCenter.authorizationStatus }

    func requestAuthorization() async throws {
        try await authorizationCenter.requestAuthorization(for: .individual)
    }

    func applyShield() {
        let selection = SharedWhitelistStore.shared.load()
        managedStore.shield.applications = nil
        managedStore.shield.webDomains = nil
        managedStore.shield.applicationCategories = .all(except: selection.applicationTokens)
        managedStore.shield.webDomainCategories = .all()
        armWatchdog()
    }

    func clearShield() {
        managedStore.clearAllSettings()
        activityCenter.stopMonitoring([LockYourConstants.activityName])
    }

    private func armWatchdog() {
        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 0, minute: 0, second: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59, second: 59),
            repeats: true,
            warningTime: nil
        )
        try? activityCenter.startMonitoring(LockYourConstants.activityName, during: schedule)
    }
}
