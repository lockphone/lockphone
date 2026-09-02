import DeviceActivity
import FamilyControls
import ManagedSettings

final class LockYourMonitorExtension: DeviceActivityMonitor {
    private let managedStore = ManagedSettingsStore(named: LockYourConstants.managedStoreName)

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        guard activity == LockYourConstants.activityName else { return }
        reconcile()
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        guard activity == LockYourConstants.activityName else { return }
        reconcile()
    }

    private func reconcile() {
        guard SharedStateStore.shared.load()?.isActive == true else {
            managedStore.clearAllSettings()
            return
        }
        let selection = SharedWhitelistStore.shared.load()
        managedStore.shield.applications = nil
        managedStore.shield.webDomains = nil
        managedStore.shield.applicationCategories = .all(except: selection.applicationTokens)
        managedStore.shield.webDomainCategories = .all()
    }
}

