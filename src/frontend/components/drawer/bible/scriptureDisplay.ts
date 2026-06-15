import type { BibleCategories } from "../../../../types/Tabs"

export type ScriptureDisplayMode = "primary" | "secondary" | "both"

export type ScriptureDisplaySettings = {
    primaryBible?: string
    secondaryBible?: string
    displayMode?: ScriptureDisplayMode
}

type Scriptures = { [key: string]: BibleCategories }

export const scriptureDisplayModeOptions: { value: ScriptureDisplayMode; label: string }[] = [
    { value: "primary", label: "Primary" },
    { value: "secondary", label: "Secondary" },
    { value: "both", label: "Both" }
]

export function getBibleOptions(scriptures: Scriptures) {
    return Object.entries(scriptures)
        .filter(([, scripture]) => !scripture.collection)
        .map(([id, scripture]) => ({ value: id, label: scripture.customName || scripture.name || id }))
}

export function resolveScriptureDisplay(settings: ScriptureDisplaySettings, scriptures: Scriptures, activeScriptureId = "") {
    const options = getBibleOptions(scriptures)
    const primary = getValidBibleId(settings.primaryBible, scriptures) || getValidBibleId(activeScriptureId, scriptures) || options[0]?.value || ""
    const secondary = getValidBibleId(settings.secondaryBible, scriptures)
    const canUseSecondary = !!secondary && secondary !== primary
    const activeCollectionIds = getCollectionBibleIds(scriptures, activeScriptureId)

    if (!getValidBibleId(settings.primaryBible, scriptures) && !secondary && activeCollectionIds.length) {
        return {
            mode: activeCollectionIds.length > 1 ? "both" : "primary",
            ids: activeCollectionIds,
            canUseSecondary: options.length > 1,
            canUseBoth: options.length > 1
        }
    }

    const requestedMode = isDisplayMode(settings.displayMode) ? settings.displayMode : "primary"
    if (requestedMode === "secondary" && canUseSecondary) {
        return { mode: "secondary" as const, ids: [secondary], canUseSecondary, canUseBoth: canUseSecondary }
    }
    if (requestedMode === "both" && canUseSecondary) {
        return { mode: "both" as const, ids: [primary, secondary].filter(Boolean), canUseSecondary, canUseBoth: canUseSecondary }
    }

    return { mode: "primary" as const, ids: primary ? [primary] : [], canUseSecondary, canUseBoth: canUseSecondary }
}

export function usesActiveScriptureCollection(settings: ScriptureDisplaySettings, scriptures: Scriptures, activeScriptureId = "") {
    const hasPreferredBible = !!getValidBibleId(settings.primaryBible, scriptures) || !!getValidBibleId(settings.secondaryBible, scriptures)
    return !hasPreferredBible && getCollectionBibleIds(scriptures, activeScriptureId).length > 1
}

function getCollectionBibleIds(scriptures: Scriptures, id: string) {
    return (scriptures[id]?.collection?.versions || []).filter((versionId) => !!getValidBibleId(versionId, scriptures))
}

function getValidBibleId(id: string | undefined, scriptures: Scriptures) {
    if (!id || scriptures[id]?.collection || !scriptures[id]) return ""
    return id
}

function isDisplayMode(value: string | undefined): value is ScriptureDisplayMode {
    return value === "primary" || value === "secondary" || value === "both"
}
