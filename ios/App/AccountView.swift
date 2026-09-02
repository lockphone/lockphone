import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var nickname = ""
    @State private var email = ""
    @State private var code = ""
    @State private var codeWasSent = false
    @State private var showingAvatars = false
    @State private var removalChoice: RemovalChoice?

    private enum RemovalChoice: String, Identifiable {
        case device, account
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    profileCard
                    leaderboardCard
                    emailCard
                    dataCard
                    if let error = model.accountError {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.lockOrange)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                    }
                }
                .padding(18)
            }
            .background(Color(red: 0.055, green: 0.057, blue: 0.05))
            .navigationTitle(AppCopy.text(zh: "账户与排行", en: "Account & rank"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(AppCopy.text(zh: "完成", en: "Done")) { dismiss() }
                }
            }
            .task {
                await model.refreshAccount()
                nickname = model.profile?.nickname ?? ""
                restorePendingVerification()
            }
            .onChange(of: model.pendingVerificationEmail) { _, _ in
                restorePendingVerification()
            }
            .sheet(isPresented: $showingAvatars) {
                AvatarPicker(selected: model.profile?.avatarId ?? 0) { id in
                    Task { await model.updateProfile(avatarId: id) }
                }
            }
            .confirmationDialog(
                removalChoice == .account
                    ? AppCopy.text(zh: "永久删除账户与全部锁机记录？", en: "Delete the account and all lock history?")
                    : AppCopy.text(zh: "退出这台设备？", en: "Sign out this device?"),
                isPresented: Binding(
                    get: { removalChoice != nil },
                    set: { if !$0 { removalChoice = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button(
                    removalChoice == .account
                        ? AppCopy.text(zh: "永久删除", en: "Delete permanently")
                        : AppCopy.text(zh: "退出设备", en: "Sign out device"),
                    role: .destructive
                ) {
                    let delete = removalChoice == .account
                    Task {
                        if await model.removeAccount(deleteEverywhere: delete) { dismiss() }
                    }
                }
                Button(AppCopy.text(zh: "取消", en: "Cancel"), role: .cancel) {}
            }
        }
        .presentationBackground(.ultraThinMaterial)
    }

    private var profileCard: some View {
        Card {
            HStack(spacing: 16) {
                Button { showingAvatars = true } label: {
                    AvatarView(id: model.profile?.avatarId ?? 0, size: 70)
                        .overlay(alignment: .bottomTrailing) {
                            Image(systemName: "pencil.circle.fill")
                                .font(.title3)
                                .symbolRenderingMode(.palette)
                                .foregroundStyle(.white, Color.lockOrange)
                        }
                }
                .buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 8) {
                    TextField(AppCopy.text(zh: "昵称", en: "Nickname"), text: $nickname)
                        .font(.title3.weight(.semibold))
                        .textInputAutocapitalization(.words)
                        .submitLabel(.done)
                        .onSubmit {
                            let value = nickname.trimmingCharacters(in: .whitespacesAndNewlines)
                            if value.count >= 2 { Task { await model.updateProfile(nickname: value) } }
                        }
                    if model.profile?.emailVerified == true {
                        Label(model.profile?.maskedEmail ?? "", systemImage: "checkmark.seal.fill")
                            .font(.caption)
                            .foregroundStyle(.green)
                    } else {
                        Text(AppCopy.text(zh: "匿名使用中", en: "Using anonymously"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private var leaderboardCard: some View {
        Card {
            HStack(spacing: 0) {
                stat(
                    value: DurationText.compact(model.stats?.totalSeconds ?? model.profile?.totalSeconds ?? 0),
                    label: AppCopy.text(zh: "累计占住", en: "Total held")
                )
                Divider().frame(height: 52)
                stat(
                    value: model.stats?.rank.map { "#\($0)" } ?? "—",
                    label: AppCopy.text(zh: "公开排名", en: "Public rank")
                )
            }
            if model.profile?.emailVerified != true {
                Text(AppCopy.text(
                    zh: "验证邮箱后，你的匿名累计时间才会出现在公开榜单。",
                    en: "Verify an email to place your anonymous total on the public leaderboard."
                ))
                .font(.footnote)
                .foregroundStyle(.secondary)
                .padding(.top, 12)
            }
        }
    }

    private func stat(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.title3.weight(.semibold)).monospacedDigit()
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var emailCard: some View {
        Card(title: AppCopy.text(zh: "邮箱登记", en: "Email registration")) {
            TextField("name@example.com", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(13)
                .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))

            if codeWasSent {
                TextField(AppCopy.text(zh: "6 位验证码", en: "6-digit code"), text: $code)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .padding(13)
                    .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
                    .onChange(of: code) { _, value in
                        code = String(value.filter(\.isNumber).prefix(6))
                    }

                Text(AppCopy.text(
                    zh: "邮件里的“返回占住”会带你回到这里；链接不包含验证码。",
                    en: "Use “Return to Lock Phone” in the email to come back here. The link never contains your code."
                ))
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Button {
                Task {
                    if codeWasSent {
                        if await model.verifyEmail(email, code: code) {
                            codeWasSent = false
                            code = ""
                        }
                    } else if await model.requestEmailCode(email) {
                        codeWasSent = true
                    }
                }
            } label: {
                HStack {
                    if model.isAccountLoading { ProgressView().tint(.black) }
                    Text(codeWasSent
                         ? AppCopy.text(zh: "验证并登记", en: "Verify and register")
                         : AppCopy.text(zh: "发送验证码", en: "Send verification code"))
                }
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
            }
            .buttonStyle(.plain)
            .background(Color.lockPaper, in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(.black)
            .disabled(email.trimmingCharacters(in: .whitespaces).isEmpty || model.isAccountLoading || (codeWasSent && code.count != 6))

            Text(AppCopy.text(
                zh: "邮箱只用于恢复累计时间和排行榜登记；公开页面仅显示脱敏邮箱。",
                en: "Email only restores your total and registers your rank. The public site shows a masked address."
            ))
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }

    private func restorePendingVerification() {
        if let pending = model.pendingVerificationEmail {
            email = pending
            codeWasSent = true
        } else if email.isEmpty {
            email = model.profile?.email ?? ""
        }
    }

    private var dataCard: some View {
        Card(title: AppCopy.text(zh: "账户数据", en: "Account data")) {
            Button(role: .destructive) { removalChoice = .device } label: {
                Label(AppCopy.text(zh: "退出这台设备", en: "Sign out this device"), systemImage: "rectangle.portrait.and.arrow.right")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Divider()
            Button(role: .destructive) { removalChoice = .account } label: {
                Label(AppCopy.text(zh: "彻底删除账户", en: "Delete account permanently"), systemImage: "trash")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

private struct Card<Content: View>: View {
    var title: String?
    @ViewBuilder let content: Content

    init(title: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                Text(title.uppercased())
                    .font(.caption2.weight(.bold))
                    .tracking(1.2)
                    .foregroundStyle(.secondary)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 20))
        .overlay { RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(0.08), lineWidth: 1) }
    }
}

struct AvatarView: View {
    let id: Int
    let size: CGFloat

    var body: some View {
        let normalized = abs(id) % 180
        let hue = Double((normalized * 47) % 360) / 360
        let accentHue = Double((normalized * 83 + 90) % 360) / 360
        ZStack {
            Circle().fill(
                LinearGradient(
                    colors: [Color(hue: hue, saturation: 0.56, brightness: 0.84), Color(hue: accentHue, saturation: 0.62, brightness: 0.58)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            Image(systemName: avatarSymbol(normalized))
                .font(.system(size: size * 0.42, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))
        }
        .frame(width: size, height: size)
        .accessibilityLabel(AppCopy.text(zh: "系统头像 \(id + 1)", en: "System avatar \(id + 1)"))
    }

    private func avatarSymbol(_ value: Int) -> String {
        let symbols = ["leaf.fill", "moon.stars.fill", "sparkles", "book.closed.fill", "mountain.2.fill", "cloud.rain.fill", "flame.fill", "bird.fill", "tortoise.fill", "cup.and.saucer.fill", "sailboat.fill", "tree.fill"]
        return symbols[value % symbols.count]
    }
}

private struct AvatarPicker: View {
    @Environment(\.dismiss) private var dismiss
    let selected: Int
    let choose: (Int) -> Void
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 5)

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 14) {
                    ForEach(0..<180, id: \.self) { id in
                        Button {
                            choose(id)
                            dismiss()
                        } label: {
                            AvatarView(id: id, size: 54)
                                .overlay {
                                    if id == selected { Circle().stroke(Color.lockOrange, lineWidth: 3) }
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(18)
            }
            .background(Color(red: 0.055, green: 0.057, blue: 0.05))
            .navigationTitle(AppCopy.text(zh: "选择头像", en: "Choose an avatar"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(AppCopy.text(zh: "取消", en: "Cancel")) { dismiss() }
                }
            }
        }
    }
}
