import FamilyControls
import SwiftUI
import UIKit

struct LockScreenView: View {
    @EnvironmentObject private var model: AppModel
    @State private var isShowingPicker = false
    @State private var isShowingAccount = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.black.opacity(0.7), .black.opacity(0.28), .black.opacity(0.86)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                Spacer(minLength: 16)
                timer
                Spacer(minLength: 20)
                sceneChooser
                whitelistSlot
                HoldToEndButton { model.endSession() }
                    .padding(.horizontal, 22)
                    .padding(.top, 14)
                    .padding(.bottom, 10)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            SceneBackground(imageName: model.scene.imageName)
                .ignoresSafeArea(.container, edges: .all)
        }
        .sheet(isPresented: $isShowingPicker) {
            WhitelistPickerView { selection in
                try model.saveWhitelist(selection)
            }
            .presentationDetents([.large])
        }
        .sheet(isPresented: $isShowingAccount) {
            AccountView()
                .environmentObject(model)
        }
        .onAppear { presentEmailVerificationIfNeeded() }
        .onChange(of: model.emailVerificationReturnRequested) { _, _ in
            presentEmailVerificationIfNeeded()
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(AppCopy.text(zh: "占住", en: "LOCK PHONE"))
                    .font(.caption.weight(.black))
                    .tracking(2)
                Text(model.scene.name)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.58))
            }
            Spacer()
            Button { isShowingAccount = true } label: {
                AvatarView(id: model.profile?.avatarId ?? 0, size: 42)
                    .overlay(Circle().stroke(.white.opacity(0.32), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(AppCopy.text(zh: "账户与排行榜", en: "Account and leaderboard"))
        }
        .padding(.horizontal, 22)
        .padding(.top, 10)
    }

    private func presentEmailVerificationIfNeeded() {
        guard model.emailVerificationReturnRequested else { return }
        isShowingAccount = true
        model.consumeEmailVerificationReturn()
    }

    private var timer: some View {
        VStack(spacing: 12) {
            Text(AppCopy.text(zh: "你已经占住手机", en: "Your phone has been held for"))
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white.opacity(0.72))
            if let startedAt = model.activeSession?.startedAt {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    Text(DurationText.full(Int(context.date.timeIntervalSince(startedAt))))
                        .font(.system(size: 58, weight: .medium, design: .rounded))
                        .monospacedDigit()
                        .contentTransition(.numericText())
                }
            }
            HStack(spacing: 7) {
                Circle().fill(Color.lockOrange).frame(width: 7, height: 7)
                Text(AppCopy.text(zh: "其他 App 已锁住", en: "Other apps are shielded"))
                    .font(.caption.weight(.medium))
            }
            .foregroundStyle(.white.opacity(0.65))
        }
    }

    private var sceneChooser: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(AppCopy.text(zh: "此刻的环境", en: "YOUR ENVIRONMENT"))
                    .font(.caption2.weight(.bold))
                    .tracking(1.4)
                    .foregroundStyle(.white.opacity(0.55))
                Spacer()
                Button { model.toggleAudio() } label: {
                    Image(systemName: model.audioEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
                        .font(.caption.weight(.semibold))
                        .frame(width: 34, height: 30)
                        .background(.ultraThinMaterial, in: Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 22)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(ScenePreset.all) { preset in
                        Button { model.chooseScene(preset) } label: {
                            VStack(alignment: .leading, spacing: 20) {
                                Image(systemName: preset.symbol)
                                    .font(.body.weight(.semibold))
                                Text(preset.name)
                                    .font(.caption.weight(.semibold))
                                    .lineLimit(1)
                            }
                            .frame(width: 108, alignment: .leading)
                            .padding(12)
                            .background(
                                preset == model.scene ? Color.lockPaper.opacity(0.95) : Color.black.opacity(0.3),
                                in: RoundedRectangle(cornerRadius: 17)
                            )
                            .foregroundStyle(preset == model.scene ? .black : .white)
                            .overlay {
                                RoundedRectangle(cornerRadius: 17)
                                    .stroke(.white.opacity(preset == model.scene ? 0 : 0.18), lineWidth: 1)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 22)
            }
        }
    }

    private var whitelistSlot: some View {
        Button {
            if model.canChooseWhitelist { isShowingPicker = true }
        } label: {
            HStack(spacing: 13) {
                Image(systemName: model.hasWhitelist ? "app.badge.checkmark.fill" : "plus.app.fill")
                    .font(.title3)
                    .foregroundStyle(Color.lockOrange)
                VStack(alignment: .leading, spacing: 3) {
                    Text(model.hasWhitelist
                         ? AppCopy.text(zh: "唯一白名单已固定", en: "Your one allowed app is fixed")
                         : AppCopy.text(zh: "选择一个白名单 App", en: "Choose one allowed app"))
                        .font(.subheadline.weight(.semibold))
                    Text(model.hasWhitelist
                         ? AppCopy.text(zh: "结束本轮后可以更换", en: "Change it after this session")
                         : AppCopy.text(zh: "本轮选定后不能更换", en: "It stays fixed for this session"))
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.52))
                }
                Spacer()
                if model.canChooseWhitelist {
                    Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(.secondary)
                } else {
                    Image(systemName: "lock.fill").font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
            .overlay { RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.13), lineWidth: 1) }
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 22)
        .padding(.top, 17)
    }
}

private struct SceneBackground: View {
    let imageName: String

    var body: some View {
        if let url = Bundle.main.url(forResource: imageName, withExtension: "jpg"),
           let image = UIImage(contentsOfFile: url.path) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .clipped()
        } else {
            Color.black
        }
    }
}

private struct WhitelistPickerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selection = FamilyActivitySelection(includeEntireCategory: false)
    @State private var error: String?
    let save: (FamilyActivitySelection) throws -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Text(AppCopy.text(
                    zh: "只能选择一个 App。分类和网站不会保存。",
                    en: "Choose exactly one app. Categories and websites are not saved."
                ))
                .font(.footnote)
                .foregroundStyle(.secondary)
                .padding(14)
                FamilyActivityPicker(selection: $selection)
                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red).padding()
                }
            }
            .navigationTitle(AppCopy.text(zh: "唯一白名单", en: "One allowed app"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(AppCopy.text(zh: "取消", en: "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(AppCopy.text(zh: "固定", en: "Fix selection")) {
                        do { try save(selection); dismiss() }
                        catch { self.error = AppCopy.text(zh: "无法保存选择。", en: "Could not save the selection.") }
                    }
                    .disabled(selection.applicationTokens.isEmpty)
                }
            }
            .onChange(of: selection.applicationTokens) { oldValue, newValue in
                guard newValue.count > 1 else { return }
                var cleaned = FamilyActivitySelection(includeEntireCategory: false)
                cleaned.applicationTokens = [newValue.subtracting(oldValue).first ?? newValue.first!]
                selection = cleaned
            }
            .onChange(of: selection.categoryTokens) { _, newValue in
                if !newValue.isEmpty { selection.categoryTokens = [] }
            }
            .onChange(of: selection.webDomainTokens) { _, newValue in
                if !newValue.isEmpty { selection.webDomainTokens = [] }
            }
        }
    }
}

private struct HoldToEndButton: View {
    @State private var progress: CGFloat = 0
    let action: () -> Void

    var body: some View {
        ZStack {
            Capsule().fill(Color.black.opacity(0.34))
            GeometryReader { proxy in
                Capsule()
                    .fill(Color.lockOrange.opacity(0.82))
                    .frame(width: proxy.size.width * progress)
            }
            .clipShape(Capsule())
            HStack(spacing: 9) {
                Image(systemName: "hand.point.up.left.fill")
                Text(AppCopy.text(zh: "长按两秒结束", en: "Hold for two seconds to finish"))
                    .font(.subheadline.weight(.semibold))
            }
        }
        .frame(height: 52)
        .overlay { Capsule().stroke(.white.opacity(0.18), lineWidth: 1) }
        .contentShape(Capsule())
        .onLongPressGesture(minimumDuration: 2, maximumDistance: 45) {
            action()
            progress = 0
        } onPressingChanged: { pressing in
            if pressing {
                progress = 0
                withAnimation(.linear(duration: 2)) { progress = 1 }
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            } else {
                withAnimation(.easeOut(duration: 0.2)) { progress = 0 }
            }
        }
    }
}
