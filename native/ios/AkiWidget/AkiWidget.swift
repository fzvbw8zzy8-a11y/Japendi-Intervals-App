//  AkiWidget.swift
//  Aki — Lock-Screen & Home-Screen widgets that one-tap launch a workout.
//
//  Each placed widget is configurable to a preset and opens the app via the
//  custom URL scheme  aki://start/<slug>  which the web app's native bridge
//  (js/native.js) routes to window.aki.start(slug).
//
//  Requires iOS 17+ (AppIntents widget configuration). Add this file to a
//  Widget Extension target named "AkiWidget" — see native/BUILD.md.

import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Palette (mocha Japandi)

extension Color {
    init(hex: UInt) {
        self.init(.sRGB,
                  red:   Double((hex >> 16) & 0xff) / 255,
                  green: Double((hex >> 8) & 0xff) / 255,
                  blue:  Double(hex & 0xff) / 255,
                  opacity: 1)
    }
    static let akiOat   = Color(hex: 0xE7DDD0)
    static let akiMocha = Color(hex: 0x463A31)
    static let akiSoft  = Color(hex: 0x6F5F52)
    static let akiClay  = Color(hex: 0xA9694E)
    static let akiSage  = Color(hex: 0x8A9A86)
    static let akiDust  = Color(hex: 0xB7A08C)
}

// MARK: - Presets (mirrors the web app's built-in presets & slugs)

enum WorkoutPreset: String, AppEnum {
    case vo2max, sprintRepeats, tabata, hill400s, pyramid, forearms, box, fourSevenEight

    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Workout" }

    static var caseDisplayRepresentations: [WorkoutPreset: DisplayRepresentation] {
        [
            .vo2max:         "VO₂ Max",
            .sprintRepeats:  "Sprint Repeats",
            .tabata:         "Tabata",
            .hill400s:       "Hill 400s",
            .pyramid:        "Pyramid",
            .forearms:       "Forearms",
            .box:            "Box 4·4·4·4",
            .fourSevenEight: "4·7·8"
        ]
    }

    /// matches slugify() in js/app.js
    var slug: String {
        switch self {
        case .vo2max:         "vo2-max"
        case .sprintRepeats:  "sprint-repeats"
        case .tabata:         "tabata"
        case .hill400s:       "hill-400s"
        case .pyramid:        "pyramid"
        case .forearms:       "forearms"
        case .box:            "box-4-4-4-4"
        case .fourSevenEight: "4-7-8"
        }
    }

    /// long label for rectangular / small faces
    var title: String {
        switch self {
        case .vo2max:         "VO₂ Max"
        case .sprintRepeats:  "Sprint Repeats"
        case .tabata:         "Tabata"
        case .hill400s:       "Hill 400s"
        case .pyramid:        "Pyramid"
        case .forearms:       "Forearms"
        case .box:            "Box Breathing"
        case .fourSevenEight: "4·7·8 Breath"
        }
    }

    /// short label for the tiny circular face
    var short: String {
        switch self {
        case .vo2max:         "VO₂"
        case .sprintRepeats:  "Sprint"
        case .tabata:         "Tabata"
        case .hill400s:       "Hill"
        case .pyramid:        "Pyr"
        case .forearms:       "Arms"
        case .box:            "Box"
        case .fourSevenEight: "478"
        }
    }
}

// MARK: - Configuration intent (lets each placed widget pick a preset)

struct SelectPresetIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Choose Workout" }
    static var description: IntentDescription { "Pick the workout this widget starts." }

    @Parameter(title: "Workout", default: .vo2max)
    var preset: WorkoutPreset
}

// MARK: - Timeline (static — the widget is a launcher, not a live timer)

struct WorkoutEntry: TimelineEntry {
    let date: Date
    let preset: WorkoutPreset
}

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> WorkoutEntry {
        WorkoutEntry(date: .now, preset: .vo2max)
    }
    func snapshot(for configuration: SelectPresetIntent, in context: Context) async -> WorkoutEntry {
        WorkoutEntry(date: .now, preset: configuration.preset)
    }
    func timeline(for configuration: SelectPresetIntent, in context: Context) async -> Timeline<WorkoutEntry> {
        Timeline(entries: [WorkoutEntry(date: .now, preset: configuration.preset)], policy: .never)
    }
}

// MARK: - Views

private struct RingGlyph: View {
    var color: Color
    var line: CGFloat = 3
    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.28), lineWidth: line)
            Circle()
                .trim(from: 0.06, to: 0.82)
                .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

struct AkiWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: Provider.Entry

    var body: some View {
        content
            .widgetURL(URL(string: "aki://start/\(entry.preset.slug)"))
            .containerBackground(for: .widget) {
                // full mocha ground on the Home Screen; accessory faces stay clear
                family == .systemSmall ? Color.akiOat : Color.clear
            }
    }

    @ViewBuilder private var content: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                RingGlyph(color: .primary, line: 2.5).padding(5)
                Text(entry.preset.short)
                    .font(.system(size: 9, weight: .semibold))
                    .minimumScaleFactor(0.6)
            }

        case .accessoryInline:
            Label("Aki · \(entry.preset.title)", systemImage: "circle.dashed")

        case .accessoryRectangular:
            HStack(spacing: 9) {
                RingGlyph(color: .primary, line: 2.5).frame(width: 26, height: 26)
                VStack(alignment: .leading, spacing: 1) {
                    Text("aki").font(.system(size: 12, weight: .semibold)).tracking(2)
                    Text(entry.preset.title).font(.system(size: 13)).lineLimit(1)
                    Text("tap to begin").font(.system(size: 10)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }

        default: // .systemSmall — Home Screen, full colour
            VStack(spacing: 8) {
                Text("aki")
                    .font(.system(size: 18, weight: .light)).tracking(6)
                    .foregroundStyle(Color.akiMocha)
                RingGlyph(color: .akiClay, line: 4)
                    .frame(width: 46, height: 46)
                Text(entry.preset.title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.akiSoft)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

// MARK: - Widget

struct AkiWidget: Widget {
    let kind = "AkiWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectPresetIntent.self, provider: Provider()) { entry in
            AkiWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Aki — Begin Workout")
        .description("One tap to start a chosen workout.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .systemSmall])
    }
}
