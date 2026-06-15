# Tagalog Scripture Aliases Discovery

## Executive Summary

FreeShow can likely support Tagalog Scripture reference aliases safely without adding Bible text, changing import formats, changing output rendering, or introducing a new database. The current reference-entry path already accepts Unicode book names and already resolves references through the active local/API Bible object. The missing piece is an alias-normalization layer before the existing `json-bible` `bookSearch(...)` call.

The safest future implementation is a small pure helper that maps known Tagalog book aliases to canonical book numbers, rewrites only the book portion of a user-entered reference to the active Bible's current book name, and then delegates to the existing parser. This preserves English reference entry, preserves imported Bible metadata, and keeps output behavior untouched.

Do not implement aliases by modifying `.fsb` files, changing Bible converters, changing imported Bible text, or patching `node_modules/json-bible`. Alias behavior should be tested with synthetic Bible metadata and synthetic verse placeholders only.

## Current Reference Parser Architecture

The Scripture drawer reference entry uses the drawer search input, passed into `Scripture.svelte` as `searchValue`.

The main flow is:

1. `src/frontend/components/drawer/Drawer.svelte` owns the visible drawer search input.
2. `src/frontend/components/drawer/Content.svelte` passes `searchValue` into the active drawer content.
3. `src/frontend/components/drawer/bible/Scripture.svelte` watches `searchValue`.
4. `Scripture.svelte` calls `referenceSearch()` whenever `searchValue.length` is nonzero.
5. `referenceSearch()` first calls its local `parseMultiChapterReference(searchValue)` helper.
6. If the multi-chapter helper does not handle the input, `referenceSearch()` calls `currentBibleData?.bibleData?.bookSearch(searchValue)`.
7. `currentBibleData.bibleData` comes from `loadJsonBible(...)` in `src/frontend/components/drawer/bible/scripture.ts`.
8. `loadJsonBible(...)` wraps local `.fsb` Bible data or API Bible data with the `json-bible` package.
9. `json-bible/lib/search.ts` implements `_bookSearch(...)`.

The multi-chapter parser in `Scripture.svelte` is FreeShow-owned logic. It supports semicolon-separated references and cross-chapter ranges such as `Genesis 1:1-12;2:1-10` by repeatedly delegating each segment to `bibleData.bookSearch(...)`.

The lower-level tokenizer in `json-bible/lib/reference.ts` uses `splitReferenceString(...)`. Its book-name regex accepts Unicode letters and marks, optional leading book numbers, spaces, apostrophes, and dash punctuation. This means names such as `Juan`, `Mateo`, `Mga Awit`, or `1 Juan` are tokenizable. The current issue is not tokenization; it is whether the parsed book name matches the active Bible's book list.

## Relevant Files And What Each File Does

| File                                                     | Role                                                                                                                                                                                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/components/drawer/Drawer.svelte`           | Owns the drawer search input used for Scripture reference entry. `Ctrl/Cmd+F` focuses this input. Phase 2B also focuses it through `Ctrl/Cmd+Shift+B` while the Scripture drawer is active.                                                   |
| `src/frontend/components/drawer/bible/Scripture.svelte`  | Main Scripture drawer UI. Contains `referenceSearch()`, `parseMultiChapterReference(...)`, `normalizeSegment(...)`, `expandCrossChapterSegment(...)`, and calls to `bibleData.bookSearch(...)`. This is the primary future integration point. |
| `src/frontend/components/drawer/bible/scripture.ts`      | Loads local/API Bibles through `json-bible`, applies `customName` book overrides before loading, and builds Scripture output/show data. Alias support should not change output logic here.                                                    |
| `src/frontend/components/quicksearch/quicksearchData.ts` | Has `getBibleResults(...)`, which also calls `bibleData.bookSearch(...)`. The Bible quick-search category is currently commented out in `quicksearch.ts`, but any future alias helper should be shareable with this path.                     |
| `src/frontend/components/quicksearch/quicksearch.ts`     | Contains the commented Bible quick-search assembly and the `bible` trigger action that opens the Scripture drawer through `openScripture`. Not a Phase 3A change target.                                                                      |
| `src/frontend/converters/zefaniaBible.ts`                | Imports Zefania XML. Uses `@bname` for book names and `@babbr` for abbreviations. These names become searchable by `json-bible`.                                                                                                              |
| `src/frontend/converters/osisBible.ts`                   | Imports OSIS XML. Uses `@name`, `@abbr`, and `@osisID`; can prompt for missing book names and otherwise defaults missing names to English.                                                                                                    |
| `src/frontend/converters/bebliaBible.ts`                 | Imports Beblia XML. Uses imported book names when present; otherwise can prompt for names or default to English names. Exports `defaultBibleBookNames`.                                                                                       |
| `src/frontend/converters/opensong.ts`                    | Handles OpenSong imports. Relevant only insofar as converted Bible book names become runtime metadata.                                                                                                                                        |
| `src/types/Bible.ts`                                     | Defines the local Bible data shape: `books[].name`, optional `books[].customName`, optional `books[].abbreviation`, chapters, and verses. No alias field exists today.                                                                        |
| `src/types/Tabs.ts`                                      | Defines `BibleCategories` metadata stored in `scriptures`; no alias settings exist today.                                                                                                                                                     |
| `src/frontend/stores.ts`                                 | Holds `scriptures`, `scripturesCache`, `activeScripture`, `openScripture`, and `customScriptureBooks`. `customScriptureBooks` is UI/cache support for renamed books, not an alias system.                                                     |
| `src/frontend/components/main/popups/Rename.svelte`      | Lets users rename local Bible book display names by writing `customName` into `scripturesCache`; those custom names are loaded into `json-bible` and become searchable.                                                                       |
| `node_modules/json-bible/lib/search.ts`                  | Implements `_bookSearch(...)`. It matches the parsed book name against loaded `book.name`, loaded `book.abbreviation`, and default 66-book IDs.                                                                                               |
| `node_modules/json-bible/lib/reference.ts`               | Tokenizes reference strings and extracts book, chapter, and verse/range portions.                                                                                                                                                             |
| `node_modules/json-bible/lib/defaults.ts`                | Contains default English Protestant book IDs and names, plus apocrypha IDs used by `json-bible`.                                                                                                                                              |

## How Aliases Appear To Work Today

FreeShow does not currently have a first-class Scripture alias map.

Existing behavior that resembles aliases:

- Imported book names work as search names. If an imported Bible names book 43 `Juan`, then `Juan 3:16` should be tokenized and matched as the active Bible's book name.
- Imported abbreviations work for exact abbreviation matches. Zefania and OSIS can import abbreviations into `books[].abbreviation`.
- User-renamed book `customName` values work because `loadJsonBible(...)` maps `customName` into `book.name` before constructing the `json-bible` instance.
- Default English book IDs work for 66-book Bibles. For example, `JHN` can resolve to John because `json-bible` checks default IDs by book number.
- Partial book-name matching works, but only against loaded book names. This is not a safe substitute for a curated alias map because ambiguous matches return no result.

Important limitations:

- A Tagalog alias will not work against an English-named Bible unless the active Bible already has that Tagalog book name or abbreviation.
- Aliases are not persisted separately from Bible text/metadata today.
- The `json-bible` matching layer is inside `node_modules`; patching it would be high maintenance and not upstream-friendly.
- `quicksearchData.ts` has a separate `bookSearch(...)` call, so any alias logic added only inside `Scripture.svelte` would not be reusable when Bible quick search is enabled later.

## Localized Book Names From Imported Bible Files

The parser already supports localized book names when those names are present in the imported Bible metadata.

Evidence:

- `src/types/Bible.ts` stores `books[].name` and optional `books[].abbreviation`.
- `convertZefaniaBible(...)` stores `@bname` and `@babbr`.
- `convertOSISBible(...)` stores `@name` and `@abbr`, prompts for missing names, and falls back to default English names if the user declines.
- `convertBebliaBible(...)` stores `@name`, prompts for missing names, and falls back to default English names if needed.
- `loadJsonBible(...)` applies `customName` before calling `JsonBible(localBible)`.
- `json-bible` normalizes book-name matching by lowercasing, removing diacritics, removing punctuation/dashes, and removing spaces.

This means a Tagalog Bible import with Tagalog book names may already accept Tagalog references for that Bible. The gap is bilingual operation where the active or primary Bible may have English book names, but the operator types Tagalog names.

## Recommended Alias Strategy

Use a small FreeShow-owned alias preprocessor before `bookSearch(...)`.

Recommended shape for Phase 3B:

1. Add a pure helper module, probably `src/frontend/components/drawer/bible/scriptureReferenceAliases.ts`.
2. Keep the helper independent from Svelte stores.
3. Parse only the book portion of the reference using logic compatible with `json-bible/lib/reference.ts`.
4. Normalize alias candidates using the same broad rules as `json-bible`: lowercase, Unicode NFD, strip diacritics, remove punctuation/dashes, and optionally remove spaces.
5. Build a lookup from:
    - Existing active Bible book names by number.
    - Existing active Bible abbreviations by number.
    - Default English IDs for 66-book Bibles.
    - A reviewed Tagalog alias map keyed by book number.
6. Try the existing input first. Only rewrite when a unique alias match exists.
7. Rewrite the book portion to the active Bible's own book name for that book number, then pass the rewritten reference to `bookSearch(...)`.
8. Return both the rewritten reference and metadata about the alias match for tests/debugging.
9. Use the helper in `Scripture.svelte` before each `bibleData.bookSearch(...)` call.
10. Later, use the same helper in `quicksearchData.ts` if Bible quick search is re-enabled.

Alias scope recommendation:

- Prefer language-specific alias maps, not one global unlabelled alias bag.
- Phase 3B can start with a built-in `tagalog` map, but the setting should be explicit if it is exposed to users.
- Long term, user-configurable aliases would be safest for churches because imported Bible naming conventions vary.
- Per-Bible aliases are useful for unusual imported book names, but the common Tagalog operator workflow is better served by language-specific aliases that work regardless of whether the active Bible uses English or Tagalog names.

Compatibility recommendation:

- Preserve English behavior by calling `bookSearch(originalInput)` first.
- Only use alias rewriting when the original search does not resolve a book.
- Use longest alias match first, so `Awit ni Solomon` is not swallowed by `Awit`.
- Treat duplicate aliases as invalid unless they point to the same book number.
- Do not write aliases into `.fsb` files.
- Do not modify Bible importers for Phase 3B.
- Do not change output/show generation.

## Proposed Tagalog Alias List For Later Review

This list is proposed for review only. It is a metadata list of book names and abbreviations, not Bible verse text. It should be checked by the church against the exact Tagalog translation and naming conventions they use.

| #   | English book    | Proposed Tagalog aliases                                    |
| --- | --------------- | ----------------------------------------------------------- |
| 1   | Genesis         | Genesis, Gen, Gn                                            |
| 2   | Exodus          | Exodo, Exo, Ex                                              |
| 3   | Leviticus       | Levitico, Lev                                               |
| 4   | Numbers         | Mga Bilang, Bilang, Blg, Num                                |
| 5   | Deuteronomy     | Deuteronomio, Deut, Dt                                      |
| 6   | Joshua          | Josue, Jos                                                  |
| 7   | Judges          | Mga Hukom, Hukom, Huk                                       |
| 8   | Ruth            | Ruth, Rut                                                   |
| 9   | 1 Samuel        | 1 Samuel, I Samuel, Unang Samuel, 1 Sam                     |
| 10  | 2 Samuel        | 2 Samuel, II Samuel, Ikalawang Samuel, 2 Sam                |
| 11  | 1 Kings         | 1 Hari, 1 Mga Hari, Unang Hari, Unang Mga Hari              |
| 12  | 2 Kings         | 2 Hari, 2 Mga Hari, Ikalawang Hari, Ikalawang Mga Hari      |
| 13  | 1 Chronicles    | 1 Cronica, 1 Mga Cronica, Unang Cronica                     |
| 14  | 2 Chronicles    | 2 Cronica, 2 Mga Cronica, Ikalawang Cronica                 |
| 15  | Ezra            | Ezra, Esdras                                                |
| 16  | Nehemiah        | Nehemias, Nehemiah                                          |
| 17  | Esther          | Ester, Esther                                               |
| 18  | Job             | Job                                                         |
| 19  | Psalms          | Mga Awit, Awit, Salmo, Psalmo, Psa, Aw                      |
| 20  | Proverbs        | Mga Kawikaan, Kawikaan, Kaw                                 |
| 21  | Ecclesiastes    | Eclesiastes, Mangangaral                                    |
| 22  | Song of Solomon | Awit ni Solomon, Mga Awit ni Solomon, Song of Solomon       |
| 23  | Isaiah          | Isaias, Isa                                                 |
| 24  | Jeremiah        | Jeremias, Jer                                               |
| 25  | Lamentations    | Mga Panaghoy, Panaghoy, Pan                                 |
| 26  | Ezekiel         | Ezekiel, Ezequiel, Eze                                      |
| 27  | Daniel          | Daniel, Dan                                                 |
| 28  | Hosea           | Oseas, Hosea, Hos                                           |
| 29  | Joel            | Joel                                                        |
| 30  | Amos            | Amos                                                        |
| 31  | Obadiah         | Obadias, Obadiah                                            |
| 32  | Jonah           | Jonas, Jonah                                                |
| 33  | Micah           | Mikas, Mica, Micah                                          |
| 34  | Nahum           | Nahum                                                       |
| 35  | Habakkuk        | Habacuc, Habakkuk, Hab                                      |
| 36  | Zephaniah       | Sofonias, Zefanias, Zephaniah                               |
| 37  | Haggai          | Hageo, Haggai                                               |
| 38  | Zechariah       | Zacarias, Zacaria, Zechariah                                |
| 39  | Malachi         | Malakias, Malachi                                           |
| 40  | Matthew         | Mateo, Mat                                                  |
| 41  | Mark            | Marcos, Mar                                                 |
| 42  | Luke            | Lucas, Luc                                                  |
| 43  | John            | Juan, Jn                                                    |
| 44  | Acts            | Mga Gawa, Gawa, Gawa ng mga Apostol                         |
| 45  | Romans          | Roma, Mga Taga Roma, Taga Roma, Taga-Roma, Rom              |
| 46  | 1 Corinthians   | 1 Corinto, 1 Mga Corinto, Unang Corinto, 1 Cor              |
| 47  | 2 Corinthians   | 2 Corinto, 2 Mga Corinto, Ikalawang Corinto, 2 Cor          |
| 48  | Galatians       | Galacia, Mga Taga Galacia, Taga Galacia, Taga-Galacia, Gal  |
| 49  | Ephesians       | Efeso, Mga Taga Efeso, Taga Efeso, Taga-Efeso, Efe          |
| 50  | Philippians     | Filipos, Mga Taga Filipos, Taga Filipos, Taga-Filipos, Fil  |
| 51  | Colossians      | Colosas, Mga Taga Colosas, Taga Colosas, Taga-Colosas, Col  |
| 52  | 1 Thessalonians | 1 Tesalonica, 1 Mga Tesalonica, Unang Tesalonica, 1 Tes     |
| 53  | 2 Thessalonians | 2 Tesalonica, 2 Mga Tesalonica, Ikalawang Tesalonica, 2 Tes |
| 54  | 1 Timothy       | 1 Timoteo, Unang Timoteo, 1 Tim                             |
| 55  | 2 Timothy       | 2 Timoteo, Ikalawang Timoteo, 2 Tim                         |
| 56  | Titus           | Tito, Titus                                                 |
| 57  | Philemon        | Filemon, Philemon                                           |
| 58  | Hebrews         | Hebreo, Mga Hebreo, Heb                                     |
| 59  | James           | Santiago, San Tiago                                         |
| 60  | 1 Peter         | 1 Pedro, Unang Pedro, 1 Ped                                 |
| 61  | 2 Peter         | 2 Pedro, Ikalawang Pedro, 2 Ped                             |
| 62  | 1 John          | 1 Juan, Unang Juan                                          |
| 63  | 2 John          | 2 Juan, Ikalawang Juan                                      |
| 64  | 3 John          | 3 Juan, Ikatlong Juan                                       |
| 65  | Jude            | Judas, Jude                                                 |
| 66  | Revelation      | Pahayag, Apocalipsis, Apokalipsis                           |

## Risks And Edge Cases

- **English behavior regression:** Avoid by trying `bookSearch(originalInput)` first and alias rewriting only as fallback.
- **Names with spaces:** `Mga Awit`, `Mga Taga Roma`, and `Awit ni Solomon` require longest-prefix matching and whitespace normalization.
- **Numbered books:** `Juan` should map to John, while `1 Juan`, `2 Juan`, and `3 Juan` should map to the epistles. Numeric prefixes must be part of alias matching.
- **Duplicate aliases:** `Awit` can point to Psalms, while `Awit ni Solomon` points to Song of Solomon. Duplicates should be detected in tests.
- **Abbreviations:** Short aliases such as `Aw`, `Kaw`, or `Fil` are operator-friendly but increase ambiguity risk. They should be reviewed carefully.
- **Diacritics and punctuation:** `json-bible` already strips diacritics, punctuation, dash punctuation, and spaces for book matching. A FreeShow alias helper should mirror that behavior.
- **Imported Bible book names:** Some files may use English names, Tagalog names, abbreviations, or manually renamed `customName` values. Alias rewriting should target book numbers, then use the active Bible's current book name.
- **Catholic or deuterocanonical book lists:** `json-bible` has default apocrypha IDs, but FreeShow's common local flow and this alias proposal target the Protestant 66-book list. Extra books need separate review.
- **Versification differences:** Aliases resolve only the book name. They do not solve chapter/verse differences between translations.
- **Partial matching:** `json-bible` already supports partial loaded-name matches, but alias matching should prefer exact normalized alias matches to avoid accidental jumps.
- **Autocomplete behavior:** `bookSearch(...)` can rewrite the search box with the active Bible's book name. After alias support, typing `Juan 3:16` against an English Bible may normalize the visible entry to `John 3:16`; this should be intentional and tested.

## Suggested Phase 3B Implementation Plan

1. Add a pure helper module for reference alias normalization.
2. Add a small Tagalog alias map keyed by canonical book number.
3. Add unit tests using synthetic 66-book Bible metadata with placeholder verse strings.
4. Add tests for the user examples: `Juan 3:16`, `Mateo 5:1-12`, `Roma 8:28`, `Awit 23`, and `Kawikaan 3:5-6`.
5. Add tests that English references still pass through unchanged.
6. Add tests for longest-alias matching, especially `Awit` versus `Awit ni Solomon`.
7. Wire the helper into `Scripture.svelte` before every `bookSearch(...)` call used for reference parsing.
8. If Bible quick search is re-enabled later, wire the same helper into `quicksearchData.ts`.
9. Do not change `.fsb`, importers, output rendering, Scripture templates, or search indexing.

## Suggested Tests For Phase 3B

Recommended test file:

- `src/frontend/components/drawer/bible/scriptureReferenceAliases.test.ts`

Suggested coverage:

- Resolves a Tagalog alias to the active Bible's English book name.
- Resolves a Tagalog alias to the active Bible's Tagalog book name when the imported Bible already uses Tagalog names.
- Leaves valid English references unchanged.
- Leaves unknown inputs unchanged.
- Handles book names with spaces.
- Handles numbered books and Roman-numeral-like user input if supported.
- Handles diacritic-insensitive alias matching.
- Chooses the longest alias match before shorter aliases.
- Detects duplicate aliases that point to different book numbers.
- Uses synthetic verses only, such as `text: "placeholder"`, with no Bible text.

## Exact Files Likely To Change In Phase 3B

Likely source files:

- `src/frontend/components/drawer/bible/Scripture.svelte`
- `src/frontend/components/drawer/bible/scriptureReferenceAliases.ts`
- `src/frontend/components/drawer/bible/scriptureReferenceAliases.test.ts`

Possible source files if Phase 3B includes settings:

- `src/electron/data/defaults.ts`
- `src/frontend/stores.ts`
- `src/types/Settings.ts`

Possible later files if Bible quick search is re-enabled:

- `src/frontend/components/quicksearch/quicksearchData.ts`
- `src/frontend/components/quicksearch/quicksearch.ts`

Files that should not change for Phase 3B:

- Bible import converters.
- `.fsb` storage format.
- Output renderer files.
- Song/template rendering paths.
- Any bundled Bible text files.

## Commands Run And Results

- `Get-Content docs/offline-bilingual-scripture-discovery.md` - Passed. Existing discovery report read first.
- `git status --short --untracked-files=all` - Passed. Working tree was clean before this documentation change.
- `rg` search across `src/frontend/components/drawer/bible`, `src/frontend/components/quicksearch`, `src/frontend/converters`, `src/types`, and `node_modules/json-bible` for parser, reference, abbreviation, and alias terms - Passed. Found the Scripture drawer parser, quick-search Bible path, converter book-name imports, and `json-bible` search/reference files.
- `rg --files node_modules/json-bible` - Passed. Confirmed available `json-bible` source files.
- `rg` search over explicit type files plus `src/frontend/converters/*.ts` - Failed due PowerShell wildcard/path parsing for the converter wildcard; useful partial output from explicit type files still printed.
- `rg` search over `node_modules/json-bible/lib`, `node_modules/json-bible/src`, and `node_modules/json-bible` - Failed with useful output because `node_modules/json-bible/src` does not exist.
- `rg -n -C 45 "async function referenceSearch|parseMultiChapterReference|ensureReferenceBook|parseChapterVerseSegment|buildReferenceLabel" src/frontend/components/drawer/bible/Scripture.svelte` - Passed. Read FreeShow reference parsing and multi-chapter parsing.
- `rg -n -C 55 "export function _bookSearch|function findBooks|export function _textSearch" node_modules/json-bible/lib/search.ts` - Passed. Read `json-bible` book matching behavior.
- `rg -n -C 60 "export function getReferenceFromSearchString|function getReference\\(|function getVerseReference|isRange|split" node_modules/json-bible/lib/reference.ts` - Passed. Read reference tokenization and verse-range parsing.
- `Get-Content src/types/Bible.ts` - Passed. Confirmed Bible book name, customName, and abbreviation shape.
- `rg -n -C 45 "export async function loadJsonBible|function loadJsonBible|JsonBible|loadScripture|scripturesCache" src/frontend/components/drawer/bible/scripture.ts src/electron/IPC/responsesMain.ts src/electron/data/save.ts` - Passed. Confirmed local/API Bible loading and `.fsb` save/load paths.
- `rg` search across Bible converters for book name, abbreviation, customName, OSIS ID, and Zefania book attributes - Passed. Confirmed imported book-name and abbreviation sources.
- `rg -n -C 40 "function getBookNumber|function getBookName|function getBookAbbreviation|getDefaultBooks|formatText|removeSpaces" node_modules/json-bible/lib/get.ts node_modules/json-bible/lib/defaults.ts node_modules/json-bible/lib/util.ts` - Passed. Read default book names/IDs and helper behavior.
- `Get-Content src/types/Tabs.ts` - Passed. Confirmed no existing Scripture alias metadata in tab categories.
- `Get-Content node_modules/json-bible/lib/util.ts` - Passed. Read utility text handling.
- `rg -n -C 45 "getBibleResults|bookSearch|searchFast|openScripture|reference" src/frontend/components/quicksearch/quicksearchData.ts src/frontend/components/quicksearch/quicksearch.ts` - Passed. Confirmed quick-search Bible path also uses `bookSearch(...)`, though assembly is currently commented out.
- `rg -n -C 40 "customScriptureBooks|customName|bible_book_local|Name book|translate" src/frontend/components/drawer/bible/Scripture.svelte src/frontend/converters/bebliaBible.ts src/frontend/converters/osisBible.ts src/frontend/stores.ts` - Passed. Confirmed custom book rename path.
- `rg` search over `src/frontend/components/drawer/bible/*.test.ts` and `*.ts` - Failed due PowerShell wildcard/path parsing.
- `rg -n "customScriptureBooks|scriptureHistory|scriptureDisplay|scriptureShortcuts|bookSearch|referenceSearch|parseMultiChapterReference" src/frontend/components/drawer/bible src/frontend/stores.ts -g "*.ts" -g "*.svelte"` - Passed. Confirmed local test patterns and touched Scripture helper files.
- `rg -n -C 30 "customScriptureBooks" src/frontend/components src/frontend/stores.ts` - Passed. Found `Rename.svelte` writes `customName` and updates `customScriptureBooks`.
- `rg -n -C 50 "const BOOKS|GEN:|MAT:|JHN:|ROM:|PSA:|PRO:" node_modules/json-bible/lib/defaults.ts` - Passed. Confirmed default 66-book IDs and apocrypha list.
- `Get-Content config/testing/vitest.config.ts` - Passed. Confirmed unit test pattern: `src/**/*.test.ts` with node environment.
- `Get-Content node_modules/json-bible/lib/search.ts` - Passed. Read full `bookSearch` behavior, including normalization.
- `rg -n -C 20 "function removeSpaces|function formatText|toLowerCase|normalize" node_modules/json-bible/lib/search.ts node_modules/json-bible/lib/reference.ts node_modules/json-bible/lib/get.ts` - Passed. Confirmed diacritic/punctuation/lowercase normalization in `json-bible` search.
- `rg -n "export function formatSearch|formatSearch\\(" src/frontend/utils/search.ts src/frontend -g "*.ts"` - Passed. Read FreeShow search normalization utilities for comparison.
- `Get-Content src/frontend/utils/search.ts` - Passed. Confirmed FreeShow search normalization also lowercases and strips diacritics.

## Phase 3A Validation

- `npm.cmd exec prettier -- --config config/formatting/.prettierrc.yaml --check docs/tagalog-scripture-aliases-discovery.md` - First run failed with Markdown formatting warnings.
- `npm.cmd exec prettier -- --config config/formatting/.prettierrc.yaml --write docs/tagalog-scripture-aliases-discovery.md` - Passed. The Markdown report was formatted.
- `npm.cmd exec prettier -- --config config/formatting/.prettierrc.yaml --check docs/tagalog-scripture-aliases-discovery.md` - Passed after formatting.
- `git diff --check` - Passed.
- `git status --short --untracked-files=all` - Passed. Shows only `?? docs/tagalog-scripture-aliases-discovery.md`.
- Prohibited-content scan with `rg` - Passed. No Bible verse text phrases, protected external-app references, or protected branding/content were found in the report.
