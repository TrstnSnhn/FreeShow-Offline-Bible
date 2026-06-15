import { describe, expect, test } from "vitest"
import { shouldFocusScriptureReferenceInput } from "./scriptureShortcuts"

function target(tagName = "DIV", options: { className?: string; contentEditable?: boolean } = {}) {
    const classNames = new Set((options.className || "").split(" ").filter(Boolean))

    return {
        tagName,
        isContentEditable: !!options.contentEditable,
        classList: {
            contains: (className: string) => classNames.has(className)
        },
        closest: (selector: string) => (selector === ".drawer_search" && classNames.has("drawer_search") ? {} : null)
    } as unknown as EventTarget
}

function event(options: Partial<KeyboardEvent> = {}) {
    return {
        key: "B",
        code: "KeyB",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
        target: target(),
        ...options
    } as KeyboardEvent
}

describe("scriptureShortcuts", () => {
    test("focuses the Scripture reference input for Ctrl+Shift+B", () => {
        expect(shouldFocusScriptureReferenceInput(event())).toBe(true)
    })

    test("focuses the Scripture reference input for Cmd+Shift+B", () => {
        expect(shouldFocusScriptureReferenceInput(event({ ctrlKey: false, metaKey: true }))).toBe(true)
    })

    test("does not override the existing Ctrl+B content search shortcut", () => {
        expect(shouldFocusScriptureReferenceInput(event({ shiftKey: false }))).toBe(false)
    })

    test("does not fire while typing in other editable fields", () => {
        expect(shouldFocusScriptureReferenceInput(event({ target: target("INPUT") }))).toBe(false)
        expect(shouldFocusScriptureReferenceInput(event({ target: target("TEXTAREA") }))).toBe(false)
        expect(shouldFocusScriptureReferenceInput(event({ target: target("SELECT") }))).toBe(false)
        expect(shouldFocusScriptureReferenceInput(event({ target: target("DIV", { contentEditable: true }) }))).toBe(false)
    })

    test("allows the shortcut when the Scripture drawer search input is already active", () => {
        expect(shouldFocusScriptureReferenceInput(event({ target: target("INPUT", { className: "search drawer_search" }) }))).toBe(true)
    })
})
