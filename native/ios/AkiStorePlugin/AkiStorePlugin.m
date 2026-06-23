//  AkiStorePlugin.m
//  Registers AkiStorePlugin with Capacitor under the JS name "AkiStore".
//  Add this file to the APP target alongside AkiStorePlugin.swift.

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AkiStorePlugin, "AkiStore",
    CAP_PLUGIN_METHOD(set, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(get, CAPPluginReturnPromise);
)
