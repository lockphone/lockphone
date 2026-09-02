import ActivityKit
import Foundation

@MainActor
final class LiveActivityManager {
    func start(sessionId: UUID, startedAt: Date, scene: ScenePreset, audioEnabled: Bool) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let state = LockActivityAttributes.ContentState(ambientName: scene.name, audioEnabled: audioEnabled)
        if let current = Activity<LockActivityAttributes>.activities.first(where: { $0.attributes.sessionId == sessionId }) {
            Task { await current.update(ActivityContent(state: state, staleDate: nil)) }
            return
        }
        for activity in Activity<LockActivityAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        do {
            _ = try Activity.request(
                attributes: LockActivityAttributes(sessionId: sessionId, startedAt: startedAt),
                content: ActivityContent(state: state, staleDate: nil),
                pushType: nil
            )
        } catch {
            // A disabled Live Activity must never prevent the lock session.
        }
    }

    func update(scene: ScenePreset, audioEnabled: Bool) {
        let state = LockActivityAttributes.ContentState(ambientName: scene.name, audioEnabled: audioEnabled)
        for activity in Activity<LockActivityAttributes>.activities {
            Task { await activity.update(ActivityContent(state: state, staleDate: nil)) }
        }
    }

    func end() {
        for activity in Activity<LockActivityAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
    }
}
