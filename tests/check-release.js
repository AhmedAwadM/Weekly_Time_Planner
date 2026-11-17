#!/usr/bin/env node
// Release consistency check (no dependencies):  node tests/check-release.js
// Fails when a release would ship mismatched versions, inline icons, or personal JSON data.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

const sw = read("service-worker.js");
const html = read("index.html");
const changelog = read("CHANGELOG.md");
const readme = read("README.md");

const version = (sw.match(/const VERSION = "([^"]+)"/) || [])[1];
check(version, "service-worker.js: VERSION constant not found");

if (version) {
  const short = version.split(".").slice(0, 2).join(".");
  for (const file of ["src/css/app.css", "src/js/app.js", "src/js/pwa-register.js"]) {
    const escaped = file.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
    const match = html.match(new RegExp(escaped + "\\?v=([0-9.]+)"));
    check(match && match[1] === version, `index.html: ${file} must be linked with ?v=${version}`);
    check(sw.includes(`"./${file}?v=" + VERSION`), `service-worker.js: APP_SHELL must precache ${file}?v=VERSION`);
    check(fs.existsSync(path.join(root, file)), `missing file: ${file}`);
  }
  const topHeading = (changelog.match(/^## (v[0-9.]+)/m) || [])[1];
  check(topHeading === "v" + short, `CHANGELOG.md: newest section is ${topHeading}, expected v${short}`);
  check(readme.includes("**Baseline:** v" + short), `README.md: Baseline must be v${short}`);
  check(html.includes(`<strong>v${short}</strong>`), `index.html: footer version must be v${short}`);
}

check(!/data:image\//.test(html), "index.html: inline data: images found (use files under assets/)");
check(/Content-Security-Policy/.test(html), "index.html: Content-Security-Policy meta tag is missing");

for (const dir of ["data", "backups", "exports"]) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  const stack = [full];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(entryPath);
      else if (entry.name.endsWith(".json")) errors.push(`personal data file must not be in the repo folder: ${path.relative(root, entryPath)}`);
    }
  }
}

if (errors.length) {
  console.error("Release check FAILED:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log(`Release check passed (version ${version}).`);
