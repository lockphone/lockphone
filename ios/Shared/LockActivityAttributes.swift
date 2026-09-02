import ActivityKit
import Foundation

struct LockActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var ambientName: String
        var audioEnabled: Bool
    }

    var sessionId: UUID
    var startedAt: Date
}

