import SwiftUI

struct AuthorizationView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.08, green: 0.085, blue: 0.07), .black],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer()
                ZStack {
                    RoundedRectangle(cornerRadius: 32)
                        .fill(Color.lockOrange.opacity(0.16))
                        .frame(width: 116, height: 116)
                    Text("占")
                        .font(.system(size: 54, weight: .black, design: .rounded))
                        .foregroundStyle(Color.lockOrange)
                }
                VStack(spacing: 12) {
                    Text(AppCopy.text(zh: "把手机占住", en: "Hold your phone still"))
                        .font(.largeTitle.weight(.bold))
                    Text(AppCopy.text(
                        zh: "占住需要屏幕使用权限，才能替你挡住其他 App。你的选择只保存在这台 iPhone 上。",
                        en: "Lock Your needs Screen Time access to shield other apps. Your selection stays only on this iPhone."
                    ))
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 30)
                }
                if let error = model.authorizationError {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color.lockOrange)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 30)
                }
                Spacer()
                Button {
                    Task { await model.requestAuthorization() }
                } label: {
                    Label(
                        AppCopy.text(zh: "授权屏幕使用权限", en: "Allow Screen Time access"),
                        systemImage: "lock.shield.fill"
                    )
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 17)
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
