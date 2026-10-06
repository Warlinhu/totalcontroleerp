const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const ico = fs.readFileSync(path.join(root, pkg.build.win.icon));
assert.equal(ico.readUInt16LE(0), 0, "Invalid official Windows icon");
assert.equal(ico.readUInt16LE(2), 1, "Windows icon must be ICO");
assert.ok(ico.readUInt16LE(4) >= 6, "Windows icon must include multiple resolutions");
const icns = fs.readFileSync(path.join(root, pkg.build.mac.icon));
assert.equal(icns.subarray(0, 4).toString(), "icns", "Invalid official macOS icon");
assert.ok(fs.existsSync(path.join(root, pkg.build.linux.icon)), "Missing Linux icon");
assert.ok(pkg.build.files.includes("electron/**/*"), "Native icons must ship with the app");
const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
assert.ok(main.includes('path.join(__dirname, "icons", "icon.ico")'), "Window must use the bundled official Windows icon");
for (const icon of [pkg.build.win.icon, pkg.build.mac.icon]) {
  assert.ok(icon.startsWith("electron/icons/"), "Native icons must not use ignored build output");
  for (const target of ["win", "mac"]) {
    if (target === "win" && icon.endsWith(".ico") || target === "mac" && icon.endsWith(".icns")) {
      assert.ok(pkg.scripts[`electron:pack:${target}`].includes(`--icon=${icon}`));
    }
  }
}
console.log("Official desktop icons verified for executable, window, tray and packaging.");