import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            if model.screenshotScreen == "account" {
                AccountView()
            } else if model.screenshotScreen == "result" {
                SessionResultView(result: SessionResult(
                    startedAt: Date().addingTimeInterval(-5_025),
                    endedAt: .now
                ))
            } else if !model.isAuthorized {
                AuthorizationView()
            } else if model.activeSession != nil {
                LockScreenView()
            } else if let result = model.result {
                SessionResultView(result: result)
            } else {
                Color(red: 0.055, green: 0.057, blue: 0.05)
                    .ignoresSafeArea()
                    .overlay { ProgressView().tint(.white) }
            }
        }
        .preferredColorScheme(.dark)
    }
}

private struct SessionResultView: View {
    @EnvironmentObject private var model: AppModel
    let result: SessionResult

    var body: some View {
        ZStack {
            Color(red: 0.055, green: 0.057, blue: 0.05).ignoresSafeArea()
            VStack(spacing: 24) {
                Spacer()
                Image(systemName: "checkmark")
                    .font(.system(size: 28, weight: .bold))
                    .frame(width: 64, height: 64)
                    .background(Color.lockOrange, in: Circle())
                    .foregroundStyle(.black)
                VStack(spacing: 8) {
                    Text(AppCopy.text(zh: "这段时间属于你", en: "That time was yours"))
                        .font(.title2.weight(.semibold))
                    Text(DurationText.full(result.duration))
                        .font(.system(size: 52, weight: .medium, design: .rounded))
                        .monospacedDigit()
                }
                Text(AppCopy.text(
                    zh: "本轮已经安全同步。重新开始后，除白名单以外的 App 会再次被占住。",
                    en: "This session is saved. Starting again will shield every app except your allowlist."
                ))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 34)
                Spacer()
                Button {
                    model.startNewSession()
                } label: {
                    Text(AppCopy.text(zh: "再占住一次", en: "Hold it again"))
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                }
                .buttonStyle(.plain)
                .background(Color.lockPaper, in: Capsule())
                .foregroundStyle(.black)
                .padding(.horizontal, 24)
                .padding(.bottom, 18)
            }
        }
    }
}

extension Color {
    static let lockOrange = Color(red: 0.95, green: 0.49, blue: 0.27)
    static let lockPaper = Color(red: 0.95, green: 0.93, blue: 0.88)
}
