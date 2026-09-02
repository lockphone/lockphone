import SwiftUI

@main
struct LockYourApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .task { await model.bootstrap() }
                .onOpenURL { url in
                    model.handleOpenURL(url)
                    Task { await model.appBecameActive() }
                }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await model.appBecameActive() } }
        }
    }
}
