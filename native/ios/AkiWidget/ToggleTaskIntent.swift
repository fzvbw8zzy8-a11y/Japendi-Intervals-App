//  ToggleTaskIntent.swift
//  Interactive App Intent run when a task is tapped inside the widget. iOS 17+.
//  Runs without opening the app, updates the shared store, reloads timelines.

import AppIntents
import WidgetKit

struct ToggleTaskIntent: AppIntent {
    static var title: LocalizedStringResource { "Toggle Task" }
    static var openAppWhenRun: Bool { false }

    @Parameter(title: "Task ID")
    var taskId: String

    init() {}
    init(taskId: String) { self.taskId = taskId }

    func perform() async throws -> some IntentResult {
        HabitStore.toggleTask(taskId)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
