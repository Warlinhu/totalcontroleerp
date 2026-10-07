# Branding update
- [x] Unify system name and page titles.
- [x] Generate native and browser icons from the current logo.
- [x] Apply icons to desktop and Android packaging without changing app identifiers.
- [x] Verify branding and explain required publication/new installations.
Verification: page titles and icon formats validated; Android branding tested with generated resource fixture; preview reports build OK. Native installation and browser end-to-end tests remain unverified because browser binaries are unavailable here. Publication and a newly generated installer are required to update existing installations.

## Generic desktop icon correction
- [x] Move native icons out of the globally ignored build folder and update packaging/runtime paths.
- [x] Verify official icon inclusion and bump native version for updates.

## Private offers and Windows installer
- [x] Show custom payment prices only through their specific links; center the offer and remove public listings.
- [x] Strengthen Windows executable/taskbar icon verification and prepare trusted signing without weakening Windows protection.
- [x] Verify source-level payment presentation and packaging checks; document external signing blocker.
Verification: source regression checks passed; official PE icon fixture accepted and missing-icon fixture rejected; desktop configuration schema validated; native syntax and lock version 1.1.3 synchronized; preview reports build OK. Browser end-to-end verification attempted but Chromium is unavailable; existing E2E runner package is not installed. Real Windows installation/taskbar appearance and Defender behavior are unverified. The attached screenshot shows only the taskbar, not the security alert.
- [ ] Configure trusted Windows signing and investigate the exact security alert — blocked on a trusted code-signing certificate/service in GitHub secrets and the user's full Windows detection message; signing alone does not guarantee SmartScreen reputation.
