import ActivityKit
import SwiftUI
import WidgetKit

private let activityOrange = Color(red: 0.94, green: 0.49, blue: 0.27)
private let activityInk = Color(red: 0.07, green: 0.071, blue: 0.059)

struct LockYourLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LockActivityAttributes.self) { context in
            LockScreenActivity(context: context)
                .activityBackgroundTint(activityInk)
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "lockphone://session"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("占")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(activityOrange)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.attributes.startedAt, style: .timer)
                        .font(.headline.monospacedDigit())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Label(context.state.ambientName, systemImage: context.state.audioEnabled ? "waveform" : "speaker.slash")
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(AppCopy.text(zh: "仍在占住", en: "Still holding"))
                            .foregroundStyle(activityOrange)
                    }
                    .font(.caption)
                }
            } compactLeading: {
                Text("占").foregroundStyle(activityOrange).fontWeight(.bold)
            } compactTrailing: {
                Text(context.attributes.startedAt, style: .timer).monospacedDigit()
            } minimal: {
                Circle().fill(activityOrange).frame(width: 9, height: 9)
            }
            .widgetURL(URL(string: "lockphone://session"))
        }
    }
}

private struct LockScreenActivity: View {
    let context: ActivityViewContext<LockActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                Text(AppCopy.text(zh: "手机已经被占住", en: "Your phone is occupied"))
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("占")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(activityOrange)
            }
            Text(context.attributes.startedAt, style: .timer)
                .font(.system(size: 32, weight: .medium, design: .rounded))
                .monospacedDigit()
            HStack {
                Label(context.state.ambientName, systemImage: context.state.audioEnabled ? "waveform" : "speaker.slash")
                    .foregroundStyle(.secondary)
                Spacer()
                Text(AppCopy.text(zh: "点击返回占住", en: "Tap to return"))
                    .foregroundStyle(activityOrange)
            }
            .font(.caption)
        }
        .padding(18)
    }
}

@main
struct LockYourWidgetBundle: WidgetBundle {
    var body: some Widget { LockYourLiveActivityWidget() }
}
