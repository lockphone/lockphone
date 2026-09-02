import Foundation

struct ScenePreset: Identifiable, Equatable, Sendable {
    let id: String
    let symbol: String
    let chineseName: String
    let englishName: String

    var name: String { AppCopy.text(zh: chineseName, en: englishName) }
    var imageName: String { id }
    var audioName: String { id }

    static let all: [ScenePreset] = [
        .init(id: "rainy-night", symbol: "cloud.rain.fill", chineseName: "雨夜", englishName: "Rainy night"),
        .init(id: "cafe-corner", symbol: "cup.and.saucer.fill", chineseName: "咖啡角", englishName: "Cafe corner"),
        .init(id: "forest-morning", symbol: "leaf.fill", chineseName: "森林晨光", englishName: "Forest morning"),
        .init(id: "after-hours-library", symbol: "books.vertical.fill", chineseName: "深夜图书馆", englishName: "After-hours library"),
        .init(id: "fireside-study", symbol: "flame.fill", chineseName: "壁炉书房", englishName: "Fireside study"),
        .init(id: "seaside-dawn", symbol: "water.waves", chineseName: "海岸晨曦", englishName: "Seaside dawn")
    ]

    static func preset(id: String?) -> ScenePreset {
        all.first(where: { $0.id == id }) ?? all[0]
    }
}

struct AccountProfile: Codable, Equatable, Sendable {
    let id: UUID
    var email: String?
    var maskedEmail: String?
    var emailVerified: Bool
    var nickname: String
    var avatarId: Int
    var totalSeconds: Int
    var activeStartedAt: Date?
}

struct AccountStats: Codable, Equatable, Sendable {
    var totalSeconds: Int
    var activeStartedAt: Date?
    var rank: Int?
}

enum DurationText {
    static func full(_ seconds: Int) -> String {
        let clamped = max(0, seconds)
        let hours = clamped / 3_600
        let minutes = (clamped % 3_600) / 60
        let remainder = clamped % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, remainder)
    }

    static func compact(_ seconds: Int) -> String {
        let clamped = max(0, seconds)
        if clamped >= 3_600 {
            return AppCopy.text(
                zh: "\(clamped / 3_600) 小时 \((clamped % 3_600) / 60) 分",
                en: "\(clamped / 3_600)h \((clamped % 3_600) / 60)m"
            )
        }
        return AppCopy.text(zh: "\(clamped / 60) 分钟", en: "\(clamped / 60)m")
    }
}
