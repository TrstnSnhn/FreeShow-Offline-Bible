const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

type ShortcutTarget = EventTarget & {
    closest?: (selector: string) => unknown
    classList?: {
        contains?: (className: string) => boolean
    }
    isContentEditable?: boolean
    tagName?: string
}

export function shouldFocusScriptureReferenceInput(event: KeyboardEvent) {
    const key = event.key?.toLowerCase()
    const isBibleFocusShortcut = (key === "b" || event.code === "KeyB") && event.shiftKey && !event.altKey && (event.ctrlKey || event.metaKey)
    if (!isBibleFocusShortcut) return false

    return !isEditableShortcutTarget(event.target)
}

function isEditableShortcutTarget(target: EventTarget | null) {
    const element = target as ShortcutTarget | null
    if (!element) return false

    if (isDrawerSearchTarget(element)) return false
    if (element.isContentEditable) return true
    if (typeof element.closest === "function" && element.closest("[contenteditable]")) return true

    const tagName = element.tagName?.toUpperCase()
    return tagName ? EDITABLE_TAGS.has(tagName) : false
}

function isDrawerSearchTarget(element: ShortcutTarget) {
    if (element.classList?.contains?.("drawer_search")) return true
    return typeof element.closest === "function" && !!element.closest(".drawer_search")
}
