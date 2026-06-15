import { describe, expect, test } from "vitest"
import { getBibleOptions, resolveScriptureDisplay } from "./scriptureDisplay"

const scriptures = {
    primary: { name: "Primary Bible" },
    secondary: { name: "Secondary Bible" },
    collection: { name: "Existing Collection", collection: { versions: ["primary", "secondary"] } }
}

describe("resolveScriptureDisplay", () => {
    test("falls back to the active Bible when no primary Bible is selected", () => {
        expect(resolveScriptureDisplay({}, scriptures, "primary")).toEqual({
            mode: "primary",
            ids: ["primary"],
            canUseSecondary: false,
            canUseBoth: false
        })
    })

    test("preserves the active collection when no preferred Bibles are selected", () => {
        expect(resolveScriptureDisplay({}, scriptures, "collection")).toEqual({
            mode: "both",
            ids: ["primary", "secondary"],
            canUseSecondary: true,
            canUseBoth: true
        })
    })

    test("uses the secondary Bible only when secondary mode is available", () => {
        expect(resolveScriptureDisplay({ primaryBible: "primary", secondaryBible: "secondary", displayMode: "secondary" }, scriptures, "primary")).toMatchObject({
            mode: "secondary",
            ids: ["secondary"]
        })
    })

    test("gracefully falls back to primary when secondary mode has no secondary Bible", () => {
        expect(resolveScriptureDisplay({ primaryBible: "primary", displayMode: "secondary" }, scriptures, "primary")).toMatchObject({
            mode: "primary",
            ids: ["primary"],
            canUseSecondary: false,
            canUseBoth: false
        })
    })

    test("uses primary and secondary together in both mode without including collections as Bible options", () => {
        expect(resolveScriptureDisplay({ primaryBible: "primary", secondaryBible: "secondary", displayMode: "both" }, scriptures, "primary")).toMatchObject({
            mode: "both",
            ids: ["primary", "secondary"]
        })

        expect(getBibleOptions(scriptures)).toEqual([
            { value: "primary", label: "Primary Bible" },
            { value: "secondary", label: "Secondary Bible" }
        ])
    })
})
