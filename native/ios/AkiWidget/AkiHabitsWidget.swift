//  AkiHabitsWidget.swift
//  Home-Screen widget showing your habits as tappable rings. Tapping a ring
//  marks the habit done for today (or increments a count) without opening the
//  app, via ToggleHabitIntent. iOS 17+.

import WidgetKit
import SwiftUI
import AppIntents

private func accentColor(_ name: String) -> Color {
    switch name {
    case "sage":  return .akiSage
    case "dust":  return .akiDust
    case "mocha": return .akiSoft
    default:      return .akiClay
    }
}

// MARK: - Timeline

struct HabitsEntry: TimelineEntry {
    let date: Date
    let habits: [HabitItem]
    let counts: [String: Int]
}

struct HabitsProvider: TimelineProvider {
    func placeholder(in context: Context) -> HabitsEntry { sample }
    func getSnapshot(in context: Context, completion: @escaping (HabitsEntry) -> Void) {
        completion(context.isPreview ? sample : current())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitsEntry>) -> Void) {
        completion(Timeline(entries: [current()], policy: .never))
    }

    private func current() -> HabitsEntry {
        let hs = HabitStore.habits()
        var counts: [String: Int] = [:]
        for h in hs { counts[h.id] = HabitStore.count(h.id) }
        return HabitsEntry(date: .now, habits: hs, counts: counts)
    }

    private var sample: HabitsEntry {
        HabitsEntry(date: .now,
                    habits: [HabitItem(id: "a", name: "Meditate", target: 1, accent: "sage"),
                             HabitItem(id: "b", name: "Water", target: 3, accent: "dust")],
                    counts: ["a": 1, "b": 2])
    }
}

// MARK: - Views

struct HabitCell: View {
    let habit: HabitItem
    let count: Int

    var body: some View {
        let done = count >= habit.target
        let color = accentColor(habit.accent)
        Button(intent: ToggleHabitIntent(habitId: habit.id)) {
            VStack(spacing: 5) {
                ZStack {
                    Circle().stroke(color.opacity(0.28), lineWidth: 3.5)
                    Circle()
                        .trim(from: 0, to: max(0.001, min(1, Double(count) / Double(max(1, habit.target)))))
                        .stroke(color, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    if done {
                        Image(systemName: "checkmark")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(color)
                    } else if habit.target > 1 {
                        Text("\(count)/\(habit.target)")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.akiSoft)
                    }
                }
                .frame(width: 38, height: 38)
                Text(habit.name)
                    .font(.system(size: 10))
                    .foregroundStyle(Color.akiSoft)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .buttonStyle(.plain)
    }
}

struct AkiHabitsEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: HabitsProvider.Entry

    private var maxCount: Int { family == .systemSmall ? 2 : 4 }

    var body: some View {
        Group {
            if entry.habits.isEmpty {
                VStack(spacing: 6) {
                    Text("aki").font(.system(size: 15, weight: .light)).tracking(5)
                        .foregroundStyle(Color.akiMocha)
                    Text("add habits in the app")
                        .font(.system(size: 10)).foregroundStyle(Color.akiSoft)
                }
            } else {
                HStack(spacing: 12) {
                    ForEach(Array(entry.habits.prefix(maxCount))) { h in
                        HabitCell(habit: h, count: entry.counts[h.id] ?? 0)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(Color.akiOat, for: .widget)
    }
}

// MARK: - Widget

struct AkiHabitsWidget: Widget {
    let kind = "AkiHabitsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitsProvider()) { entry in
            AkiHabitsEntryView(entry: entry)
        }
        .configurationDisplayName("Aki — Habits")
        .description("Tap a habit to mark it done today.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
