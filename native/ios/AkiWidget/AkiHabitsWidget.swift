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
    let tasks: [TaskItem]
    let reorder: Bool
}

// a pair of up/down move arrows shown in reorder mode
private struct MoveArrows<UpIntent: AppIntent, DownIntent: AppIntent>: View {
    let up: UpIntent
    let down: DownIntent
    let canUp: Bool
    let canDown: Bool
    var body: some View {
        HStack(spacing: 8) {
            Button(intent: up) { Image(systemName: "chevron.up").font(.system(size: 13, weight: .semibold)) }
                .buttonStyle(.plain).disabled(!canUp).opacity(canUp ? 1 : 0.28)
            Button(intent: down) { Image(systemName: "chevron.down").font(.system(size: 13, weight: .semibold)) }
                .buttonStyle(.plain).disabled(!canDown).opacity(canDown ? 1 : 0.28)
        }
        .foregroundStyle(Color.akiSoft)
    }
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
        return HabitsEntry(date: .now, habits: hs, counts: counts,
                           tasks: HabitStore.tasks(), reorder: HabitStore.reorderMode())
    }

    private var sample: HabitsEntry {
        HabitsEntry(date: .now,
                    habits: [HabitItem(id: "a", name: "Meditate", target: 1, accent: "sage"),
                             HabitItem(id: "b", name: "Water", target: 3, accent: "dust"),
                             HabitItem(id: "c", name: "Read", target: 1, accent: "clay")],
                    counts: ["a": 1, "b": 2, "c": 0],
                    tasks: [TaskItem(id: "t1", text: "Call dentist", kind: "once", done: false),
                            TaskItem(id: "t2", text: "Tidy desk", kind: "daily", done: true)],
                    reorder: false)
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
    var reorder: Bool = false
    var canUp: Bool = false
    var canDown: Bool = false

    var body: some View {
        if reorder {
            HStack(spacing: 13) {
                HabitRing(color: accentColor(habit.accent), count: count, target: habit.target)
                    .frame(width: 30, height: 30)
                Text(habit.name).font(.system(size: 15)).foregroundStyle(Color.akiMocha).lineLimit(1)
                Spacer(minLength: 6)
                MoveArrows(up: MoveHabitIntent(habitId: habit.id, delta: -1),
                           down: MoveHabitIntent(habitId: habit.id, delta: 1),
                           canUp: canUp, canDown: canDown)
            }
            .padding(.vertical, 5)
        } else {
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
}

struct TaskRow: View {
    let task: TaskItem
    var reorder: Bool = false
    var canUp: Bool = false
    var canDown: Bool = false

    private var checkbox: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 6)
                .stroke(task.done ? Color.akiSage : Color.akiDust, lineWidth: 2)
                .frame(width: 22, height: 22)
            if task.done {
                RoundedRectangle(cornerRadius: 6).fill(Color.akiSage).frame(width: 22, height: 22)
                Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.akiOat)
            }
        }
        .frame(width: 30, height: 30)
    }

    private var label: some View {
        Text(task.text)
            .font(.system(size: 15))
            .strikethrough(task.done)
            .foregroundStyle(task.done ? Color.akiFaint : Color.akiMocha)
            .lineLimit(1)
    }

    var body: some View {
        if reorder {
            HStack(spacing: 13) {
                checkbox
                label
                Spacer(minLength: 6)
                MoveArrows(up: MoveTaskIntent(taskId: task.id, delta: -1),
                           down: MoveTaskIntent(taskId: task.id, delta: 1),
                           canUp: canUp, canDown: canDown)
            }
            .padding(.vertical, 5)
        } else {
            Button(intent: ToggleTaskIntent(taskId: task.id)) {
                HStack(spacing: 13) {
                    checkbox
                    label
                    Spacer(minLength: 6)
                    Text(task.kind.uppercased())
                        .font(.system(size: 9)).tracking(1).foregroundStyle(Color.akiFaint)
                }
                .padding(.vertical, 5)
            }
            .buttonStyle(.plain)
        }
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

    // large panel: habits first, then tasks fill the remaining rows (7 total)
    private var panelHabits: [HabitItem] { Array(entry.habits.prefix(7)) }
    private var panelTasks: [TaskItem] { Array(entry.tasks.prefix(max(0, 7 - panelHabits.count))) }

    var body: some View {
        Group {
            if entry.habits.isEmpty && entry.tasks.isEmpty {
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

    private var headerSummary: String {
        let total = panelHabits.count + panelTasks.count
        let done = doneCount + panelTasks.filter { $0.done }.count
        return "\(done) / \(total) today"
    }

    private var largePanel: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center) {
                Text("aki").font(.system(size: 16, weight: .light)).tracking(5).foregroundStyle(Color.akiMocha)
                Spacer()
                Text(entry.reorder ? "reorder" : headerSummary)
                    .font(.system(size: 11)).tracking(0.5).foregroundStyle(Color.akiSoft)
                Button(intent: ToggleReorderIntent()) {
                    Image(systemName: entry.reorder ? "checkmark" : "arrow.up.arrow.down")
                        .font(.system(size: 12, weight: .medium)).foregroundStyle(Color.akiSoft)
                }
                .buttonStyle(.plain)
                .padding(.leading, 8)
            }
            .padding(.bottom, 2)

            ForEach(Array(panelHabits.enumerated()), id: \.element.id) { idx, h in
                HabitRow(habit: h, count: entry.counts[h.id] ?? 0,
                         reorder: entry.reorder, canUp: idx > 0, canDown: idx < panelHabits.count - 1)
                if idx < panelHabits.count - 1 || !panelTasks.isEmpty { divider }
            }

            if !panelTasks.isEmpty {
                Text("tasks")
                    .font(.system(size: 9)).tracking(2).textCase(.uppercase)
                    .foregroundStyle(Color.akiFaint)
                    .padding(.top, 2)
                ForEach(Array(panelTasks.enumerated()), id: \.element.id) { idx, t in
                    TaskRow(task: t,
                            reorder: entry.reorder, canUp: idx > 0, canDown: idx < panelTasks.count - 1)
                    if idx < panelTasks.count - 1 { divider }
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var divider: some View {
        Rectangle().fill(Color.akiMocha.opacity(0.07)).frame(height: 1)
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
