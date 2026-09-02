import ManagedSettings
import ManagedSettingsUI
import UIKit

final class LockYourShieldConfiguration: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration { makeConfiguration() }
    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration { makeConfiguration() }
    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration { makeConfiguration() }
    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration { makeConfiguration() }

    private func makeConfiguration() -> ShieldConfiguration {
        let chinese = AppCopy.isChinese
        let background = UIColor(red: 0.07, green: 0.071, blue: 0.059, alpha: 1)
        let paper = UIColor(red: 0.95, green: 0.93, blue: 0.88, alpha: 1)
        let muted = UIColor(red: 0.64, green: 0.62, blue: 0.57, alpha: 1)
        let orange = UIColor(red: 0.94, green: 0.49, blue: 0.27, alpha: 1)
        return ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: background,
            icon: UIImage(systemName: "hourglass.bottomhalf.filled"),
            title: .init(text: chinese ? "这部手机已经被占住" : "This phone is occupied", color: paper),
            subtitle: .init(
                text: chinese ? "回到「占住」长按两秒，才能结束这段时间。" : "Return to Lock Phone and hold for two seconds to finish this session.",
                color: muted
            ),
            primaryButtonLabel: .init(text: chinese ? "继续占住" : "Keep holding", color: background),
            primaryButtonBackgroundColor: orange,
            secondaryButtonLabel: .init(text: chinese ? "暂时不看" : "Not now", color: orange)
        )
    }
}
