//  ToggleHabitIntent.swift
//  Interactive App Intent run when a habit ring is tapped inside the widget.
//  iOS 17+. Runs without opening the app, updates the shared store, and
//  reloads the widget timelines.

import AppIntents
import WidgetKit

struct ToggleHabitIntent: AppIntent {
    static var title: LocalizedStringResource { "Toggle Habit" }
    static var openAppWhenRun: Bool { false }

    @Parameter(title: "Habit ID")
    var habitId: String

    init() {}
    init(habitId: String) { self.habitId = habitId }

    func perform() async throws -> some IntentResult {
        HabitStore.toggle(habitId)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
