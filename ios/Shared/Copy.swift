import Foundation

enum AppCopy {
    static var isChinese: Bool { Locale.preferredLanguages.first?.hasPrefix("zh") == true }
    static func text(zh: String, en: String) -> String { isChinese ? zh : en }
}

