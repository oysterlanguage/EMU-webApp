# EMU-webApp Agent Notes

## Project Overview
- **Tech stack:** AngularJS 1.x hybrid (TypeScript/ES2015) with webpack build, Sass styling, and legacy services/controllers.
- **Purpose:** Web-based speech annotation editor supporting waveform/spectrogram display, TextGrid/annotJSON interchange, and bundle-based workflows.
- **Key directories:**
  - `src/app/components` – Angular components (e.g., `emu-webapp.component.ts` main shell).
  - `src/app/services` – Angular services and business logic (drag/drop, data, level/segment manipulation).
  - `src/styles` – Sass stylesheets merged by webpack.
  - `demoDBs`, `configFiles` – Sample data/configs used by the dev server.
- **Build/test:** `npm run build` (webpack prod compile), `npm run start` (webpack-dev-server with OpenSSL legacy provider), `npm test` (Karma).

## Recent Changes & Patterns
- **Compatibility fixes:** Updated start/build scripts with `cross-env NODE_OPTIONS=--openssl-legacy-provider` and ensured webpack dev server listens on `0.0.0.0`.
- **Audio support:** Added MP3 decoding fallback (Web Audio API) and adjusted drop-zone copy to reflect supported formats.
- **Drag-and-drop enhancements:**
  - Removed 10-bundle limit, retained BASE64 storage for audio to satisfy schema validation.
  - Stored media payloads when dropping files so reloading bundles works without TextGrids.
  - Updated bundle schema (with `oneOf`) so BASE64/GETURL remain string-enforced while allowing raw buffers internally.
  - Added logging hooks when diagnosing add-level failures.
- **UI tweaks:**
  - Moved playback/zoom toolbar to the header.
  - Sidebar width now adapts to longest bundle name via CSS custom property.
  - Added footer shortcut panel summarising common keyboard commands; expand as new combos ship.
- **Annotation creation:** Guarded level/attribute definition initialization so audio-only bundles can add SEGMENT/EVENT levels without pre-existing configs.

## Guidance for Future Agents
- **When editing TypeScript classes:**
  - Stick to controller-as (`$ctrl`) references in templates; wiring mistakes (using bare `addLevelSegBtnClick()`) silently break handlers.
  - Log via `console.log('[EMU] ...')` when debugging; existing code uses this convention.
  - Update `ConfigProviderService.curDbConfig.levelDefinitions` whenever you create new levels programmatically; dependent services expect it.
- **Schema updates:** If adjusting validation files (under `src/schemaFiles`), mirror changes in `dist/schemaFiles` or ensure build regenerates them.
- **Drag/drop flows:** Any change in `DragnDropService` likely needs coordination with `DragnDropDataService` and `DbObjLoadSaveService`; data structures are shared.
- **Styling:** Sass files are concatenated via webpack; prefer CSS custom properties/extends instead of inline width hacks for responsive tweaks.
- **Testing:** After structural UI changes, run `npm run build` and manually sanity-check in the browser (dev server) because automated UI tests are minimal.

## Common Commands
```bash
npm install          # install deps
npm run start        # dev server, accessible on http://localhost:9000
npm run build        # production build, regenerates dist assets
npm test             # karma test suite (rarely touched but available)
```

Keep this document updated with structural insights, debugging conventions, and recent architectural tweaks so future agents ramp quickly.
