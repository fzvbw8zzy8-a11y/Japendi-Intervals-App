//  AkiHabitsWidget.swift
//  Home-Screen widget showing your habits as tappable rings/rows. Tapping marks
//  the habit done for today (or increments a count) without opening the app,
//  via ToggleHabitIntent. iOS 17+.
//
//  The systemLarge size is the "focus panel" — dedicate a Home-Screen page to it
//  (see native/BUILD.md → Focus Home Screen).

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
                             HabitItem(id: "b", name: "Water", target: 3, accent: "dust"),
                             HabitItem(id: "c", name: "Read", target: 1, accent: "clay"),
                             HabitItem(id: "d", name: "Stretch", target: 1, accent: "mocha")],
                    counts: ["a": 1, "b": 2, "c": 0, "d": 1])
    }
}

// MARK: - Ring

private struct HabitRing: View {
    let color: Color
    let count: Int
    let target: Int
    var line: CGFloat = 3.5
    var body: some View {
        let done = count >= target
        ZStack {
            Circle().stroke(color.opacity(0.28), lineWidth: line)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, Double(count) / Double(max(1, target)))))
                .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if done {
                Image(systemName: "checkmark").font(.system(size: 12, weight: .semibold)).foregroundStyle(color)
            } else if target > 1 {
                Text("\(count)/\(target)").font(.system(size: 9, weight: .medium)).foregroundStyle(Color.akiSoft)
            }
        }
    }
}

// MARK: - Compact cell (small / medium)

struct HabitCell: View {
    let habit: HabitItem
    let count: Int
    var body: some View {
        Button(intent: ToggleHabitIntent(habitId: habit.id)) {
            VStack(spacing: 5) {
                HabitRing(color: accentColor(habit.accent), count: count, target: habit.target)
                    .frame(width: 38, height: 38)
                Text(habit.name)
                    .font(.system(size: 10)).foregroundStyle(Color.akiSoft)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Row (large focus panel)

struct HabitRow: View {
    let habit: HabitItem
    let count: Int
    var body: some View {
        let done = count >= habit.target
        Button(intent: ToggleHabitIntent(habitId: habit.id)) {
            HStack(spacing: 13) {
                HabitRing(color: accentColor(habit.accent), count: count, target: habit.target)
                    .frame(width: 30, height: 30)
                Text(habit.name)
                    .font(.system(size: 15))
                    .foregroundStyle(done ? Color.akiSoft : Color.akiMocha)
                    .lineLimit(1)
                Spacer(minLength: 6)
                if done {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 15)).foregroundStyle(accentColor(habit.accent))
                }
            }
            .padding(.vertical, 5)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Entry view

struct AkiHabitsEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: HabitsProvider.Entry

    private var maxCount: Int {
        switch family {
        case .systemSmall:  return 2
        case .systemMedium: return 4
        default:            return 6   // systemLarge focus panel
        }
    }

    private var doneCount: Int {
        entry.habits.filter { (entry.counts[$0.id] ?? 0) >= $0.target }.count
    }

    var body: some View {
        Group {
            if entry.habits.isEmpty {
                emptyState
            } else if family == .systemLarge {
                largePanel
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

    private var emptyState: some View {
        VStack(spacing: 6) {
            Text("aki").font(.system(size: 15, weight: .light)).tracking(5).foregroundStyle(Color.akiMocha)
            Text("add habits in the app").font(.system(size: 10)).foregroundStyle(Color.akiSoft)
        }
    }

    private var largePanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text("aki").font(.system(size: 16, weight: .light)).tracking(5).foregroundStyle(Color.akiMocha)
                Spacer()
                Text("\(doneCount) / \(entry.habits.count) today")
                    .font(.system(size: 11)).tracking(0.5).foregroundStyle(Color.akiSoft)
            }
            .padding(.bottom, 2)

            ForEach(Array(entry.habits.prefix(maxCount))) { h in
                HabitRow(habit: h, count: entry.counts[h.id] ?? 0)
                if h.id != entry.habits.prefix(maxCount).last?.id {
                    Rectangle().fill(Color.akiMocha.opacity(0.07)).frame(height: 1)
                }
            }
            Spacer(minLength: 0)
        }
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
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
