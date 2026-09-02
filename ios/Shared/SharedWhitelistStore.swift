import FamilyControls
import Foundation

final class SharedWhitelistStore: @unchecked Sendable {
    static let shared = SharedWhitelistStore()
    private let defaults: UserDefaults?

    init(defaults: UserDefaults? = UserDefaults(suiteName: LockYourConstants.appGroupIdentifier)) {
        self.defaults = defaults
    }

    func load() -> FamilyActivitySelection {
        guard let data = defaults?.data(forKey: LockYourConstants.whitelistKey),
              let selection = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
        else { return FamilyActivitySelection(includeEntireCategory: false) }
        return sanitize(selection)
    }

    func save(_ selection: FamilyActivitySelection) throws {
        let data = try PropertyListEncoder().encode(sanitize(selection))
        defaults?.set(data, forKey: LockYourConstants.whitelistKey)
    }

    func sanitize(_ selection: FamilyActivitySelection) -> FamilyActivitySelection {
        var value = FamilyActivitySelection(includeEntireCategory: false)
        if let token = selection.applicationTokens.first { value.applicationTokens = [token] }
        return value
    }
}

