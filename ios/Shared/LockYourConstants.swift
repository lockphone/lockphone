import DeviceActivity
import ManagedSettings

enum LockYourConstants {
    static let appGroupIdentifier = "group.www.coreader.studio.lockyour"
    static let managedStoreName = ManagedSettingsStore.Name("lock-your.focus")
    static let activityName = DeviceActivityName("lock-your.focus.daily-watchdog")
    static let sharedStateKey = "lock_your.shared_state.v1"
    static let whitelistKey = "lock_your.whitelist.v1"
    static let pendingSessionsKey = "lock_your.pending_sessions.v1"
}

