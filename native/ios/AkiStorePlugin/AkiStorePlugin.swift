//  AkiStorePlugin.swift
//  A tiny Capacitor plugin exposing the shared App Group store to the web app,
//  so habit data is visible to the WidgetKit extension.
//
//  JS usage (from js/app.js / js/native.js):
//    Capacitor.Plugins.AkiStore.set({ value: "<json>" })
//    Capacitor.Plugins.AkiStore.get()  // → { value: "<json>" }
//
//  Add this file (and AkiStorePlugin.m) to the APP target. Enable the
//  App Group "group.app.aki.intervals" on the app target. See native/BUILD.md.

import Foundation
import Capacitor
import WidgetKit

@objc(AkiStorePlugin)
public class AkiStorePlugin: CAPPlugin {
    private static let suiteName = "group.app.aki.intervals"
    private static let storeKey  = "aki.data"

    @objc func set(_ call: CAPPluginCall) {
        guard let value = call.getString("value") else {
            call.reject("Missing 'value'")
            return
        }
        UserDefaults(suiteName: AkiStorePlugin.suiteName)?.set(value, forKey: AkiStorePlugin.storeKey)
        // refresh the widgets so they reflect changes made in the app
        if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
        call.resolve()
    }

    @objc func get(_ call: CAPPluginCall) {
        let value = UserDefaults(suiteName: AkiStorePlugin.suiteName)?.string(forKey: AkiStorePlugin.storeKey) ?? ""
        call.resolve(["value": value])
    }
}
