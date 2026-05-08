import { registerRootComponent } from "expo";
import { Platform } from "react-native";

import App from "./App";

// On web, react-native-skia ships its renderer as a WebAssembly module
// (CanvasKit). It must be loaded before any Skia API runs — otherwise calls
// like `Skia.FontMgr.System()` blow up with "TypefaceFontProvider undefined".
// On native (iOS / Android), Skia is bundled into the runtime — register
// immediately.
if (Platform.OS === "web") {
  // Dynamic require: the web entry only exists in the package's /web/ subpath
  // and importing it on native would fail.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { LoadSkiaWeb } = require("@shopify/react-native-skia/lib/module/web");
  LoadSkiaWeb()
    .then(() => registerRootComponent(App))
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("Failed to load Skia (CanvasKit WASM):", err);
      registerRootComponent(App);
    });
} else {
  registerRootComponent(App);
}
