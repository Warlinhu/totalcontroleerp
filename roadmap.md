# Branding update
- [x] Unify system name and page titles.
- [x] Generate native and browser icons from the current logo.
- [x] Apply icons to desktop and Android packaging without changing app identifiers.
- [x] Verify branding and explain required publication/new installations.
Verification: page titles and icon formats validated; Android branding tested with generated resource fixture; preview reports build OK. Native installation and browser end-to-end tests remain unverified because browser binaries are unavailable here. Publication and a newly generated installer are required to update existing installations.

## Generic desktop icon correction
- [x] Move native icons out of the globally ignored build folder and update packaging/runtime paths.
- [x] Verify official icon inclusion and bump native version for updates.
