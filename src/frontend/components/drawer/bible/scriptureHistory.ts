export type ScriptureHistoryItem = {
    id?: string
    book?: number | string
    chapter?: number | string
    verse?: (number | string)[]
    reference?: string
    text?: string
}

export function addScriptureHistoryItem(history: ScriptureHistoryItem[], item: ScriptureHistoryItem) {
    const key = getScriptureHistoryKey(item)
    if (!key) return history

    return [...history.filter((entry) => getScriptureHistoryKey(entry) !== key), item]
}

export function getRecentScriptureHistory(history: ScriptureHistoryItem[], limit = 5) {
    const recent: ScriptureHistoryItem[] = []
    const usedKeys = new Set<string>()

    for (let i = history.length - 1; i >= 0 && recent.length < limit; i--) {
        const item = history[i]
        const key = getScriptureHistoryKey(item)
        if (!key || usedKeys.has(key)) continue

        usedKeys.add(key)
        recent.push(item)
    }

    return recent
}

function getScriptureHistoryKey(item: ScriptureHistoryItem) {
    if (item.book === undefined || item.chapter === undefined || !item.verse?.length) return ""
    return [item.book, item.chapter, item.verse.map((verse) => verse.toString()).join(",")].join(":")
}
