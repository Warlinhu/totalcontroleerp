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
- Derive browser and native icons from the same current brand asset; keep generated ICO/ICNS and Android launcher resources in source control so CI does not require image tooling.
- Preserve native app IDs, repository URLs and release filenames when changing display branding to retain update compatibility.
- Apply Android launcher resources after Capacitor sync and prevent remote page titles from overriding the Electron window title.
