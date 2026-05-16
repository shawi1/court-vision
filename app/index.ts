import { registerRootComponent } from "expo";
import { Platform } from "react-native";

// On web, react-native-skia's `Skia.web.js` runs `JsiSkApi(global.CanvasKit)`
// at the top of the module. If anything imports `@shopify/react-native-skia`
// before CanvasKit (WASM) is loaded, the resulting `Skia` object is built with
// `undefined` and every later call (PictureRecorder, FontMgr, etc.) crashes.
// So on web we MUST NOT statically import App — that would transitively pull
// in Skia. Defer the App require until LoadSkiaWeb resolves.
// On native (iOS / Android) Skia is bundled into the runtime.
if (Platform.OS === "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { LoadSkiaWeb } = require("@shopify/react-native-skia/lib/module/web");
  LoadSkiaWeb()
    .then(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const App = require("./App").default;
      registerRootComponent(App);
    })
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("Failed to load Skia (CanvasKit WASM):", err);
    });
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const App = require("./App").default;
  registerRootComponent(App);
}
