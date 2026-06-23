//  MoveItemIntents.swift
//  Interactive App Intents for reordering habits/tasks from the widget, and a
//  toggle that flips the focus panel into "reorder mode". iOS 17+.

import AppIntents
import WidgetKit

struct ToggleReorderIntent: AppIntent {
    static var title: LocalizedStringResource { "Toggle Reorder Mode" }
    static var openAppWhenRun: Bool { false }

    func perform() async throws -> some IntentResult {
        HabitStore.setReorderMode(!HabitStore.reorderMode())
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

struct MoveHabitIntent: AppIntent {
    static var title: LocalizedStringResource { "Move Habit" }
    static var openAppWhenRun: Bool { false }

    @Parameter(title: "Habit ID") var habitId: String
    @Parameter(title: "Delta") var delta: Int

    init() {}
    init(habitId: String, delta: Int) { self.habitId = habitId; self.delta = delta }

    func perform() async throws -> some IntentResult {
        HabitStore.moveHabit(habitId, by: delta)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

struct MoveTaskIntent: AppIntent {
    static var title: LocalizedStringResource { "Move Task" }
    static var openAppWhenRun: Bool { false }

    @Parameter(title: "Task ID") var taskId: String
    @Parameter(title: "Delta") var delta: Int

    init() {}
    init(taskId: String, delta: Int) { self.taskId = taskId; self.delta = delta }

    func perform() async throws -> some IntentResult {
        HabitStore.moveTask(taskId, by: delta)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
