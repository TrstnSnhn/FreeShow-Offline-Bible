# Offline Bilingual Scripture Discovery

## Executive Summary

FreeShow already has most of the architecture needed for a fast offline bilingual Scripture workflow. It supports local Bible import, stores Bible text outside the repo as `.fsb` files, keeps Bible metadata in synced settings, loads Scripture through the existing drawer, can combine multiple translations through Scripture collections, and can render multi-version Scripture through the existing template/dynamic-value system.

The smallest maintainable path is a built-in enhancement to the existing Scripture drawer, supported by a small internal utility module if the new logic grows. Phase 1 should not introduce a new database, a new output renderer, bundled Bible files, VerseVIEW assets, or a plugin-style system. It should use the current local `.fsb` Bible storage, `scriptures` metadata store, `scripturesCache`, existing collections, and Scripture templates.

## Repository Stack And Entry Points

- App stack: Electron desktop app with a Svelte 3 renderer, Vite build, TypeScript, and Node/Electron IPC.
- Build system: `vite.config.mjs`, `svelte.config.mjs`, `package.json` scripts, and Electron main output at `build/electron/index.js`.
- Main Electron entry point: `src/electron/index.ts`.
- Renderer entry point: `src/frontend/main.ts`, with main UI rooted in `src/frontend/App.svelte`, `src/frontend/MainLayout.svelte`, and `src/frontend/MainOutput.svelte`.
- Remote/stage web apps: `src/server/remote` and `src/server/stage`, served through the Electron/server layer.
- State management: Svelte stores in `src/frontend/stores.ts` and remote/stage-specific stores in `src/server/remote/util/stores.ts` and `src/server/stage/util/stores.ts`.
- Persistent data: `electron-store` based JSON stores in `src/electron/data/store.ts`, plus file-based data folders from `src/electron/utils/files.ts`.
- UI pattern: Svelte components, shared helper modules, typed data structures in `src/types`, and store-driven presentation state.

## Current FreeShow Scripture Architecture

Scripture is centered on the drawer tab under `src/frontend/components/drawer/bible`.

- `Scripture.svelte` owns the interactive Scripture drawer UI: version tab content, book/chapter/verse navigation, reference input handling, content search UI, verse selection, history button, collection display, and Scripture-specific keyboard shortcuts.
- `scripture.ts` owns the operational Scripture logic: loading local/API Bible data, resolving active verses, applying collection offsets, formatting verse text, building temporary live output slides, creating persistent Scripture shows, selecting Scripture templates, and opening Route.Bible links.
- `src/frontend/stores.ts` holds the relevant global stores:
  - `scriptures`: metadata for local, API, and collection Scripture tabs.
  - `scripturesCache`: loaded local Bible content.
  - `activeScripture`: current Bible/collection plus selected reference.
  - `scriptureSettings`: Scripture template and display settings.
  - `scriptureHistory` and `scriptureHistoryUsed`: recent live Scripture selections for the current session.
  - `openScripture`: programmatic navigation into Scripture from remote/quick search/other UI.

The current model distinguishes between:

- Bible metadata, stored in synced settings.
- Bible text, stored locally as `.fsb` files and cached in memory after loading.
- API Bible metadata, stored like other Bible tabs but marked with `api: true`.
- Collections, stored as `scriptures[id].collection.versions`, with optional `previewIndex` and per-version/chapter `offsets`.

## Current Offline Bible Support

Offline Bible text is supported through local imports.

- `src/frontend/components/main/popups/ImportScripture.svelte` provides the Scripture import popup. It supports API imports and local imports.
- Local imports accept `xml`, `xmm`, `json`, and `fsb` files.
- The UI describes supported local formats as XML Zefania, OSIS, Beblia, OpenSong, and JSON FreeShow.
- `src/frontend/converters/bible.ts` dispatches imported Bible files to format converters and handles FreeShow `.fsb` import.
- `.fsb` content is JSON using the FreeShow Bible shape, commonly saved as `[id, bible]`.
- `src/electron/IPC/responsesMain.ts` handles `Main.BIBLE` through `loadScripture`, reading `{BibleName}.fsb` from the user data Bibles folder, with a legacy fallback to `Documents/Bibles`.
- `src/electron/data/save.ts` writes `scripturesCache` entries back to `.fsb` files in the Bibles folder.
- `src/electron/utils/files.ts` maps `dataFolderNames.scriptures` to `Bibles`.

Supported converter paths found:

- `src/frontend/converters/zefaniaBible.ts`
- `src/frontend/converters/osisBible.ts`
- `src/frontend/converters/bebliaBible.ts`
- `src/frontend/converters/opensong.ts`
- `src/frontend/converters/bible.ts`

`src/electron/data/bibleDetecter.ts` detects several Bible-like formats, including Zefania, OSIS, Beblia, OpenSong, SoftProjector, WordProject, BibleQuote, iBible, SQLite, and MDB markers. The frontend Bible converter currently wires only the FreeShow/Zefania/OSIS/Beblia/OpenSong paths for Scripture import.

## Current Online Scripture Support

Online/API Scripture support uses the `json-bible` package.

- `src/frontend/components/drawer/bible/scripture.ts` defines `SCRIPTURE_API_URL` as `https://api.churchapps.org/content/bibles`.
- `getApiBiblesList()` first queries that ChurchApps Bible endpoint and falls back to an API key lookup via `getKey("bibleapi")`.
- `loadJsonBible(id)` loads API Bibles with `JsonBibleApi(...)` when `scriptures[id].api` is true.
- `src/electron/data/defaults.ts` seeds several API Bible metadata entries, including KJV, ASV, WEB, WMB, and BSB. These are metadata entries, not bundled Bible text.

For the offline bilingual goal, API Bibles should not be treated as offline unless the user imports a local copy through a supported format.

## Current Search Behavior

FreeShow has two Scripture search paths today.

Reference search in the Scripture drawer:

- `Scripture.svelte` watches the drawer search text and calls `referenceSearch()`.
- It uses `json-bible` `bookSearch()` for inputs such as `John 3:16`.
- It has extra `parseMultiChapterReference()` logic for semicolon-separated and cross-chapter references.
- Matching results update `activeScripture` and selected verses through `openBook`, `openChapter`, and `openVerse`.

Word/phrase search in the Scripture drawer:

- `Scripture.svelte` has a separate content search field toggled by `Ctrl+B`.
- `searchInBible()` calls `currentBibleData.bibleData.textSearch(contentSearchValue)`.
- Search results can be opened and double-clicked to play.

Quick search:

- `src/frontend/components/quicksearch/quicksearchData.ts` has `getBibleResults()`.
- It resolves the active Bible, uses `bookSearch()` for references, and uses `src/frontend/utils/searchFast.ts` for local in-memory indexed text search when possible.
- `src/frontend/utils/searchFast.ts` builds a single in-memory Bible word index and returns scored verse matches.
- `src/frontend/components/quicksearch/quicksearch.ts` currently has the Bible category code commented out, although the `bible` trigger action still exists and can open the Scripture drawer through `openScripture`.

## Current Verse Selection And Scripture Show Creation

- Verse selection is stored in `activeScripture.reference`.
- `scriptureRangeSelect()` in `scripture.ts` handles normal, ctrl/meta, and shift range selection.
- Verse splitting is supported for long verses and verse parts.
- `playScripture()` creates temporary live Scripture slides and sends them to the active output using `setOutput("slide", ...)`.
- `createScriptureShow()` creates a persistent Scripture show in the Scripture category.
- `getScriptureShow()` records a `show.reference` object with Scripture metadata including collection, translations, version, API flag, book, chapter, verses, and attribution string.

## Current Collections And Multiple Bible Versions

FreeShow already supports multi-version Scripture through collections.

- `src/frontend/components/main/popups/CreateCollection.svelte` creates a collection from two or more existing Bible tabs.
- The collection stores `versions` as Bible IDs.
- `Scripture.svelte` treats a collection as `activeScriptures`, loads all versions when needed, and can show all versions in the drawer with `scriptureSettings.showAllVersions`.
- `scripture.ts` uses a collection's versions in `getActiveScripturesContent()`.
- Per-version/chapter offsets exist under `collection.offsets`, which is important for translation alignment differences.
- `swapPreviewBible(collectionId)` cycles the preview Bible used by a collection.

This is the strongest existing integration point for KJV/Tagalog/Both behavior.

## Current Output And Template Behavior

Scripture rendering uses the same output pipeline as other slides.

- `playScripture()` builds temporary output slides with `tempItems`, `translations`, `settings`, `attributionString`, and `customDynamicValues`.
- `src/frontend/components/helpers/output.ts` sends output state to active outputs and applies output style templates.
- `getStyleTemplate()` selects `templateScripture`, `templateScripture_2`, `templateScripture_3`, or `templateScripture_4` depending on the number of Scripture translations.
- `setTemplateStyle()` merges the current Scripture slide with the selected style/template.
- `replaceScriptureValues()` injects dynamic Scripture values into template textboxes.
- `src/frontend/utils/templates.ts` provides `TemplateHelper.createSlides()`.
- `src/frontend/utils/createData.ts` contains default Scripture templates using dynamic values such as `{scripture_text}` and `{scripture_reference}`.
- `src/frontend/components/output/Output.svelte` renders temporary Scripture slides, applies style templates, and displays attribution strings.
- `src/frontend/components/helpers/showActions.ts` provides dynamic value fallback/replacement behavior for Scripture placeholders.

The current template system is already bilingual-capable because it supports translation-indexed dynamic values such as `{scripture1_text}`, `{scripture2_text}`, and matching style overrides for two translations.

## Other Presentation Systems Relevant To The Workflow

Output windows:

- `src/electron/output/OutputHelper.ts` routes output IPC messages such as `CREATE`, `REMOVE`, `TOGGLE_OUTPUTS`, `UPDATE_BOUNDS`, `SET_VALUE`, and `REQUEST_PREVIEW`.
- `src/electron/output/helpers/OutputLifecycle.ts` creates Electron `BrowserWindow` instances for outputs and loads the output route.
- `src/electron/output/helpers/OutputVisibility.ts`, `OutputBounds.ts`, `OutputSend.ts`, and `OutputValues.ts` manage output state, bounds, visibility, and messages.
- `src/frontend/components/settings/tabs/OutputsTabs.svelte` creates normal outputs and stage outputs.

Stage/control views:

- `src/server/stage` is the stage display web app.
- `src/server/stage/util/stores.ts` holds stage output, slide cache, media, overlays, timers, audio, and layout state.
- `src/server/stage/util/itemHelpers.ts` handles temporary output items, which matters for live drawer Scripture.
- `src/server/remote/components/pages/Scripture.svelte` and related remote components provide remote Scripture control.

Media/backgrounds:

- Media drawers and helpers live under `src/frontend/components/drawer/media` and `src/frontend/components/helpers/media.ts`.
- Output backgrounds are rendered by `src/frontend/components/output/layers/Background.svelte`.
- Background output is sent through the same `setOutput("background", ...)` helper path used by presentation shortcuts and media playback.

Audio/music:

- Audio state lives in `src/frontend/stores.ts` as `audioFolders`, `audioStreams`, `audioPlaylists`, `playingAudio`, and related stores.
- Playback logic is in `src/frontend/audio/audioPlayer.ts`, `audioFading.ts`, and `audioPlaylist.ts`.
- Audio UI lives under `src/frontend/components/drawer/audio`.

Keyboard shortcuts:

- Global shortcuts live in `src/frontend/utils/shortcuts.ts`.
- `Ctrl+N` creates a Scripture show when the show page is active and the active drawer tab is Scripture.
- `Ctrl+H` is reserved from the global history popup when Scripture is active so the Scripture drawer can handle Scripture history.
- `F1` through `F5`, arrows, page keys, and space drive presentation output clearing/advancing.
- Scripture-specific shortcuts are handled locally in `Scripture.svelte`: Enter, Ctrl/Cmd+Enter, Ctrl/Cmd+R, Ctrl/Cmd+H, Ctrl/Cmd+B, and Ctrl/Cmd+Arrow navigation.

## Relevant Files

| File | Role |
| --- | --- |
| `package.json` | Electron/Svelte/Vite scripts, dependencies, GPL-3.0 package metadata. |
| `vite.config.mjs` | Renderer build entry and dev server config. |
| `svelte.config.mjs` | Svelte preprocess and TypeScript config. |
| `src/electron/index.ts` | Main Electron process entry and IPC registration. |
| `src/electron/preload.ts` | Renderer bridge setup. |
| `src/electron/data/store.ts` | JSON/electron-store backed persisted data lists. |
| `src/electron/data/defaults.ts` | Default synced settings, including default API Scripture metadata and `scriptureSettings`. |
| `src/electron/data/save.ts` | Saves local Scripture cache entries to `.fsb` files. |
| `src/electron/data/import.ts` | Reads import files and routes Bible imports. |
| `src/electron/data/bibleDetecter.ts` | Detects Bible import formats. |
| `src/electron/IPC/responsesMain.ts` | Handles `Main.BIBLE`, `Main.READ_BIBLES_FOLDER`, imports, and local Scripture loading. |
| `src/electron/utils/files.ts` | Defines the `Bibles` data folder and file helpers. |
| `src/types/Bible.ts` | Bible/book/chapter/verse TypeScript shape. |
| `src/types/Scripture.ts` | Runtime Scripture content shape for selected passages. |
| `src/types/Tabs.ts` | Scripture tab/category and collection metadata types. |
| `src/types/Settings.ts` | Settings types used by output/style/template configuration. |
| `src/frontend/stores.ts` | Main Svelte stores, including Scripture metadata/cache/history/settings. |
| `src/frontend/components/drawer/bible/Scripture.svelte` | Main Scripture drawer UI, navigation, search, selection, collection display, and shortcuts. |
| `src/frontend/components/drawer/bible/scripture.ts` | Scripture loading, formatting, show creation, temporary output, template dynamic values, and collection handling. |
| `src/frontend/components/main/popups/ImportScripture.svelte` | API/local Scripture import popup. |
| `src/frontend/components/main/popups/CreateCollection.svelte` | Creates multi-version Scripture collections. |
| `src/frontend/components/main/popups/SelectTemplate.svelte` | Selects Scripture templates, including multi-translation template variants. |
| `src/frontend/converters/bible.ts` | Bible import dispatcher and `.fsb` import handling. |
| `src/frontend/converters/zefaniaBible.ts` | Zefania XML Bible converter. |
| `src/frontend/converters/osisBible.ts` | OSIS XML Bible converter. |
| `src/frontend/converters/bebliaBible.ts` | Beblia XML Bible converter. |
| `src/frontend/converters/opensong.ts` | OpenSong Bible converter. |
| `src/frontend/converters/verseview.ts` | Existing VerseVIEW song import converter; not a Bible database or Scripture source. |
| `src/frontend/utils/searchFast.ts` | In-memory local Bible word index used by quick search code. |
| `src/frontend/components/quicksearch/quicksearchData.ts` | Bible quick search data provider, currently able to produce Bible results. |
| `src/frontend/components/quicksearch/quicksearch.ts` | Quick search UI and trigger actions; Bible category is currently commented out. |
| `src/frontend/utils/templates.ts` | Template helper used by Scripture slide generation. |
| `src/frontend/components/helpers/output.ts` | Output state dispatch, template merging, Scripture dynamic value replacement. |
| `src/frontend/components/helpers/showActions.ts` | Dynamic value fallback/replacement behavior. |
| `src/frontend/components/output/Output.svelte` | Runtime output renderer for slides, temporary Scripture, backgrounds, overlays, and attribution. |
| `src/frontend/utils/shortcuts.ts` | Global keyboard shortcuts and presentation controls. |
| `src/electron/output/OutputHelper.ts` | Electron output message router. |
| `src/electron/output/helpers/OutputLifecycle.ts` | Output window creation/removal/focus. |
| `src/frontend/components/settings/tabs/OutputsTabs.svelte` | UI for normal and stage outputs. |
| `src/server/remote/components/pages/Scripture.svelte` | Remote Scripture control page. |
| `src/server/stage` | Stage display app and stage output rendering helpers. |

## Recommended Implementation Strategy

Use a small built-in enhancement to the existing Scripture drawer.

Recommended Phase 1 shape:

1. Add persisted preferred primary and secondary Bible IDs to `scriptureSettings` or a closely related Scripture settings object.
2. Add a compact mode control in `Scripture.svelte`: Primary, Secondary, Both.
3. When Both is selected, prefer the existing collection path. Either require/select an existing two-version collection or create/use an internal collection-like runtime selection without changing `.fsb`.
4. Keep output rendering on the existing `playScripture()` and `createScriptureShow()` paths.
5. Reuse existing two-translation Scripture templates and `templateScripture_2`.
6. Add bounded recent references using existing `scriptureHistory` first; persist only if the church needs recents after restart.
7. Add fast shortcut-based verse entry by focusing/reusing the existing drawer reference input and `openScripture` flow.

Do not build a new database in Phase 1. The current `.fsb` files plus in-memory cache are adequate for local offline use. If search performance is still poor after enabling fast quick search, improve `searchFast.ts` before considering a persisted index.

Do not use a plugin-style implementation unless FreeShow gains or exposes an internal plugin API for drawer tabs and output rendering. No suitable Scripture plugin extension point was found in this pass.

## Minimal Phased Roadmap

Phase 1: Offline bilingual drawer workflow

- Persist primary and secondary Bible preferences.
- Add Primary/Secondary/Both mode to the Scripture drawer.
- Use existing local Bible imports and existing collections/templates.
- Make recent verse history easier to access for service operation.
- Add or refine a keyboard path for quick verse entry without switching apps.
- No `.fsb` schema change and no bundled Bible text.

Phase 2: Quick search integration

- Re-enable or finish the Bible quick search category.
- Route quick reference results into `openScripture`.
- Use `searchFast.ts` for local Bible text search.
- Add tests around reference result routing and local index behavior.

Phase 3: Import and pairing UX

- Improve the import popup to guide users toward local/offline Bible imports.
- Add validation or warnings for API-only Bibles when offline mode is expected.
- Make KJV/Tagalog pairing easier after both Bibles are imported.
- Keep all Bible text user-supplied unless licenses are verified.

Phase 4: Optional performance work

- Consider per-Bible in-memory index caching if churches use large Bible files and frequent phrase search.
- Consider persisted indexes only after measuring startup/search costs and confirming the current in-memory approach is insufficient.

## Risk List

- Bible copyright: Do not bundle Tagalog Bible text or any copyrighted Bible text without verified license.
- KJV licensing varies by jurisdiction. The default metadata says KJV is public domain except UK Crown Copyright notice, but Phase 1 should still avoid bundling text.
- API Bibles are online sources. They must not be presented as offline unless imported locally.
- Collections can expose verse-number and versification differences. Existing collection offsets help, but KJV/Tagalog alignment still needs real-world validation.
- `Scripture.svelte` and `scripture.ts` are large and central. Phase 1 changes should be narrow and tested.
- `searchFast.ts` currently has a single in-memory index. Multi-Bible search needs cache invalidation and active-Bible awareness.
- Bible quick search is partially implemented but disabled in `quicksearch.ts`; enabling it may reveal unfinished UI or ranking behavior.
- Existing Scripture templates support up to four translations. Bilingual display is safe, but arbitrary future multilingual workflows should respect that limit.
- Existing VerseVIEW song import support must remain separate from this feature. Do not copy VerseVIEW Bible data, database formats, branding, assets, or workflow-specific code.
- Preserve FreeShow GPL-3.0 notices and upstream credit.

## Test Strategy

- Unit-test any new pure utility logic for preferred Bible selection, mode resolution, bounded recent references, and shortcut parsing.
- Add focused tests for reference parsing/routing if quick entry behavior is extracted from `Scripture.svelte`.
- Add regression tests around local Bible index behavior if `searchFast.ts` changes.
- Manually test with user-imported local Bibles only:
  - Primary mode plays only the primary Bible.
  - Secondary mode plays only the secondary Bible.
  - Both mode uses the two-version template path.
  - Recent verses reopen and replay the expected reference.
  - Enter/Ctrl+Enter behavior remains compatible with existing `scriptureSettings.enterSwapped`.
  - API Bible metadata still loads as before.
  - Existing collection offset controls still work.
- For output verification, test normal output, multi-output, and stage output with temporary live Scripture and created Scripture shows.

## Exact Files Likely To Change In Phase 1

- `src/frontend/components/drawer/bible/Scripture.svelte`
- `src/frontend/components/drawer/bible/scripture.ts`
- `src/frontend/stores.ts`
- `src/electron/data/defaults.ts`
- `src/frontend/utils/save.ts`
- `src/types/Tabs.ts`
- `src/types/Settings.ts`
- `src/frontend/components/quicksearch/quicksearch.ts` if fast global verse entry uses quick search.
- `src/frontend/components/quicksearch/quicksearchData.ts` if quick search Bible results are enabled/refined.
- `src/frontend/utils/searchFast.ts` only if local phrase search/index behavior needs adjustment.
- `src/frontend/components/main/popups/ImportScripture.svelte` only if Phase 1 includes import UX guidance.
- `src/frontend/components/main/popups/CreateCollection.svelte` only if Phase 1 adds a pairing helper instead of using existing collection creation unchanged.

## Open Questions Before Implementation

- Which Tagalog translation will the church use, and what is its license?
- Should recent verses persist across app restarts, or is session-only history enough?
- Should Both mode require an explicit FreeShow collection, or should it work from primary/secondary preferences without creating a visible collection?
- Should quick verse entry live in the Scripture drawer search box, the global quick search, or both?
- What shortcut should focus quick verse entry without conflicting with existing FreeShow shortcuts?
- Should KJV/Tagalog/Both labels be hard-coded for the church workflow, or should the UI use generic Primary/Secondary/Both labels based on selected Bible names?
- How should mismatched versification be handled during live service: strict verse number matching, existing collection offsets, or manual fallback selection?
- Should offline mode hide API Bibles, warn about API Bibles, or simply prefer local Bibles?

## Validation Commands

Commands run after this documentation-only change:

| Command | Result |
| --- | --- |
| `npm.cmd run test:format` | Failed. The script ran `npx prettier --config config/formatting/.prettierrc.yaml --check src scripts`; local dependencies appear unavailable, `npx` attempted to use `prettier@3.8.4`, and Prettier failed with `Cannot find package 'prettier-plugin-svelte' imported from ...\noop.js`. |
| `npm.cmd run test:unit` | Failed. `vitest` is not recognized as an internal or external command, which indicates local JS dependencies are not installed or not available on PATH. |
| `npm.cmd exec prettier -- --config config/formatting/.prettierrc.yaml --check docs/offline-bilingual-scripture-discovery.md` | Failed for the same environment reason as the format check: `Cannot find package 'prettier-plugin-svelte' imported from ...\noop.js`. |
| `git status --short --untracked-files=all` | Passed. Shows only `?? docs/offline-bilingual-scripture-discovery.md`. |

No dependency installation was performed during this discovery pass.
