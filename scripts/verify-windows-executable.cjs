const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

async function verify(executablePath) {
  const { NtExecutable, NtExecutableResource, Resource, Data } = await import("resedit");
  const root = path.resolve(__dirname, "..");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const source = Data.IconFile.from(fs.readFileSync(path.join(root, pkg.build.win.icon)));
  const expected = source.icons.map(({ data }) => Buffer.from(data.isRaw() ? data.bin : data.generate()));
  const exe = NtExecutable.from(fs.readFileSync(executablePath), { ignoreCert: true });
  const entries = NtExecutableResource.from(exe).entries;
  const groups = Resource.IconGroupEntry.fromEntries(entries);
  assert.ok(groups.length, "The packaged executable has no Windows icon");
  assert.ok(groups.some((group) => {
    const actual = group.getIconItemsFromEntries(entries).map((data) => Buffer.from(data.isRaw() ? data.bin : data.generate()));
    return expected.every((icon) => actual.some((item) => item.equals(icon)));
  }), "The packaged executable still contains a generic or outdated icon");
  console.log("Packaged Windows executable contains every official icon resolution.");
}

module.exports = async (context) => {
  if (context.electronPlatformName !== "win32") return;
  await verify(path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`));
};

if (require.main === module) {
  verify(process.argv[2]).catch((error) => { console.error(error.message); process.exitCode = 1; });
}