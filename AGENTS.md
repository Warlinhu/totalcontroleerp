<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Native branding
- Derive browser and native icons from the same current brand asset; keep generated ICO/ICNS under electron/icons (never the globally ignored build directory) and Android launcher resources in source control so CI does not require image tooling.
- Preserve native app IDs, repository URLs and release filenames when changing display branding to retain update compatibility.
- Apply Android launcher resources after Capacitor sync and prevent remote page titles from overriding the Electron window title.
- Verify embedded Windows executable icon resources after resource editing/signing and before release; use the installed application identity for taskbar relaunch metadata to prevent generic Electron branding.
- Windows signing credentials must come from GitHub secrets; never disable system protection or claim signing guarantees SmartScreen reputation or excludes malware detections.
- Custom payment offers must be fetched by their exact link code, never enumerated on public plan screens, so private test prices cannot leak into normal plan selection.
