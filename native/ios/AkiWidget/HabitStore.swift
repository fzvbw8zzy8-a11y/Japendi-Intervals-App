//  HabitStore.swift
//  Reads/writes the habit data the web app mirrors into the shared App Group
//  (group.app.aki.intervals → key "aki.data"). Shape matches js/app.js:
//    { "habits": [{ "id", "name", "target", "accent" }],
//      "log": { "yyyy-MM-dd": { "<id>": <count> } } }
//
//  Add this file to the AkiWidget extension target. The App Group must be
//  enabled on BOTH the app and the widget targets (see native/BUILD.md).

import Foundation

struct HabitItem: Identifiable {
    let id: String
    let name: String
    let target: Int
    let accent: String
}

struct TaskItem: Identifiable {
    let id: String
    let text: String
    let kind: String   // "once" | "daily"
    let done: Bool
}

enum HabitStore {
    static let suiteName = "group.app.aki.intervals"
    static let storeKey  = "aki.data"

    private static func defaults() -> UserDefaults? { UserDefaults(suiteName: suiteName) }

    static func todayKey() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"          // local date, matches the web app
        return f.string(from: Date())
    }

    private static func root() -> [String: Any] {
        guard let s = defaults()?.string(forKey: storeKey),
              let data = s.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return obj
    }

    private static func write(_ root: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: root),
              let s = String(data: data, encoding: .utf8) else { return }
        defaults()?.set(s, forKey: storeKey)
    }

    static func habits() -> [HabitItem] {
        let arr = root()["habits"] as? [[String: Any]] ?? []
        return arr.compactMap { h in
            guard let id = h["id"] as? String, let name = h["name"] as? String else { return nil }
            let target = (h["target"] as? Int) ?? 1
            let accent = (h["accent"] as? String) ?? "clay"
            return HabitItem(id: id, name: name, target: max(1, target), accent: accent)
        }
    }

    static func count(_ id: String, day: String = todayKey()) -> Int {
        let log = root()["log"] as? [String: Any] ?? [:]
        let d = log[day] as? [String: Any] ?? [:]
        return (d[id] as? Int) ?? 0
    }

    /// tap behaviour mirrors the app: increment, wrapping to 0 once the target is met
    static func toggle(_ id: String) {
        var data = root()
        let day = todayKey()
        var log = data["log"] as? [String: Any] ?? [:]
        var d = log[day] as? [String: Any] ?? [:]

        let target = habits().first(where: { $0.id == id })?.target ?? 1
        let cur = (d[id] as? Int) ?? 0
        let next = cur >= target ? 0 : cur + 1
        if next == 0 { d.removeValue(forKey: id) } else { d[id] = next }

        log[day] = d
        data["log"] = log
        write(data)
    }

    // MARK: Tasks

    /// active tasks: 'daily' always shown (with today's done state); completed
    /// 'once' tasks are cleared, matching the app
    static func tasks() -> [TaskItem] {
        let arr = root()["tasks"] as? [[String: Any]] ?? []
        let tlog = (root()["tasklog"] as? [String: Any])?[todayKey()] as? [String: Any] ?? [:]
        return arr.compactMap { t in
            guard let id = t["id"] as? String, let text = t["text"] as? String else { return nil }
            let kind = (t["kind"] as? String) ?? "once"
            if kind == "daily" {
                return TaskItem(id: id, text: text, kind: kind, done: ((tlog[id] as? Int) ?? 0) > 0)
            }
            if (t["done"] as? Bool) == true { return nil }   // completed one-off → cleared
            return TaskItem(id: id, text: text, kind: kind, done: false)
        }
    }

    static func toggleTask(_ id: String) {
        var data = root()
        var arr = data["tasks"] as? [[String: Any]] ?? []
        guard let idx = arr.firstIndex(where: { ($0["id"] as? String) == id }) else { return }
        let kind = (arr[idx]["kind"] as? String) ?? "once"

        if kind == "daily" {
            let day = todayKey()
            var tlog = data["tasklog"] as? [String: Any] ?? [:]
            var d = tlog[day] as? [String: Any] ?? [:]
            if ((d[id] as? Int) ?? 0) > 0 { d.removeValue(forKey: id) } else { d[id] = 1 }
            tlog[day] = d
            data["tasklog"] = tlog
        } else {
            arr[idx]["done"] = !((arr[idx]["done"] as? Bool) ?? false)
            data["tasks"] = arr
        }
        write(data)
    }

    // MARK: Reordering

    /// per-widget "reorder mode" — rows become up/down arrows when on
    static func reorderMode() -> Bool { defaults()?.bool(forKey: "aki.reorder") ?? false }
    static func setReorderMode(_ on: Bool) { defaults()?.set(on, forKey: "aki.reorder") }

    static func moveHabit(_ id: String, by delta: Int) {
        var data = root()
        var arr = data["habits"] as? [[String: Any]] ?? []
        guard let i = arr.firstIndex(where: { ($0["id"] as? String) == id }) else { return }
        let j = i + delta
        guard j >= 0 && j < arr.count else { return }
        arr.swapAt(i, j)
        data["habits"] = arr
        write(data)
    }

    /// move relative to the *visible* task order (skips cleared one-off tasks)
    static func moveTask(_ id: String, by delta: Int) {
        let visible = tasks().map { $0.id }
        guard let vi = visible.firstIndex(of: id) else { return }
        let vj = vi + delta
        guard vj >= 0 && vj < visible.count else { return }
        let otherId = visible[vj]
        var data = root()
        var arr = data["tasks"] as? [[String: Any]] ?? []
        guard let i = arr.firstIndex(where: { ($0["id"] as? String) == id }),
              let j = arr.firstIndex(where: { ($0["id"] as? String) == otherId }) else { return }
        arr.swapAt(i, j)
        data["tasks"] = arr
        write(data)
    }
}
