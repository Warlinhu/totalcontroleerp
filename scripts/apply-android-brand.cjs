const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const resources = path.join(root, "android/app/src/main/res");
if (!fs.existsSync(resources)) throw new Error("Add and sync Android before applying launcher icons.");
fs.cpSync(path.join(root, "public/android-icons"), resources, { recursive: true });
// Adaptive icons otherwise keep Capacitor's generated foreground/background.
const adaptive = path.join(resources, "mipmap-anydpi-v26");
fs.mkdirSync(adaptive, { recursive: true });
const xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@android:color/transparent"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>\n';
for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  fs.writeFileSync(path.join(adaptive, name), xml);
}
// Existing Android directories also receive the current display name.
const strings = path.join(resources, "values/strings.xml");
if (fs.existsSync(strings)) {
  const content = fs.readFileSync(strings, "utf8").replace(
    /(<string name="(?:app_name|title_activity_main)">)[\s\S]*?(<\/string>)/g,
    "$1Total Controle - Gestão Empresarial$2",
  );
  fs.writeFileSync(strings, content);
}
console.log("Applied current Android launcher icons and display name.");