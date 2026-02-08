# AGENTS.md

Project summary:
Static personal homepage for Blaž Škrlj, served via GitHub Pages. Single-page site with a WebGL black-hole background and a profile modal.

Origins / attribution:
- This project started from `https://github.com/rossning92/Blackhole`.
- Kudos to `rossning92` for the original Blackhole project foundation.

Shippable runtime files:
- `index.html`
- `css/styles.css`
- `js/scripts.js`
- `assets/img/bw.jpg`
- `assets/img/favicon.ico`
- `bhsim/assets/color_map.png`
- `bhsim/assets/skybox_nebula_dark/equirect.png`
- `bhsim/shader/blackhole_main.frag`
- `bhsim/shader/simple.vert`
- `bhsim/shader/tonemapping.frag`

Conventions:
- Keep changes minimal and consistent with the current visual style unless explicitly asked to redesign.
- Prefer:
  - `index.html` for structure/content.
  - `css/styles.css` for styling.
  - `js/scripts.js` for behavior/performance/detail control.
- Keep ASCII by default unless existing content already uses non-ASCII (e.g., “Blaž”).
- If `css/styles.css` or `js/scripts.js` changes, update cache-bust query params in `index.html`.

Development notes:
- Static site only; no build step.
- Local preview on port `5001`:
  - `cd <repo-root>`
  - `setsid -f python3 -m http.server 5001 >/tmp/skblaz_server5001.log 2>&1`
- Verify server:
  - `ss -ltnp | rg ':5001'`
  - `curl -I http://127.0.0.1:5001`
- Open:
  - Same machine: `http://127.0.0.1:5001` or `http://localhost:5001`
  - Same LAN: `http://<host-ip>:5001` (`hostname -I`)
  - Remote/WSL/SSH: port-forward `5001`.
- Stop:
  - `pkill -f 'python3 -m http.server 5001'`

Testing:
- No automated tests.
- Manual browser validation is required after significant changes.
- For animation/detail changes, validate at detail `0`, detail `1`, and at least one mid value.

Security and privacy:
- Never commit secrets or credentials in any source file.
- Keep runtime assets free of EXIF/IPTC/XMP metadata (strip image metadata before commit).
- Prefer minimal external dependencies; remove unused third-party JS/CSS includes.
- Current runtime images are metadata-stripped (`favicon.ico`, `bw.jpg`, `color_map.png`, `equirect.png`).

Visual QA workflow:
- For rendering/animation regressions, capture startup frames at multiple timestamps (e.g., ~1.5s, ~2.5s, ~5s, ~8s).
- If reproducing from a user screenshot, start with the same viewport size.
- For seam/line artifacts, verify early startup frames, not only steady-state.

Repository hygiene:
- Keep root clean: no temporary screenshots, backup folders, or scratch PDFs/TXTs.
- `.gitignore` covers common local QA artifacts; still delete temporary files you create.
- Keep source changes focused to runtime files unless explicitly requested otherwise.
