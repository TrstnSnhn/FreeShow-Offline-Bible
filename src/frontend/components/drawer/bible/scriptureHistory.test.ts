import { describe, expect, test } from "vitest"
import { addScriptureHistoryItem, getRecentScriptureHistory } from "./scriptureHistory"

describe("scriptureHistory", () => {
    test("returns newest unique references across Bible versions", () => {
        const oldReference = { id: "primary", book: 43, chapter: 3, verse: [16], reference: "John 3:16", text: "old" }
        const latestReference = { id: "secondary", book: 43, chapter: 3, verse: [16], reference: "John 3:16", text: "latest" }
        const otherReference = { id: "primary", book: 19, chapter: 23, verse: [1], reference: "Psalm 23:1", text: "other" }

        expect(getRecentScriptureHistory([oldReference, latestReference, otherReference], 5)).toEqual([otherReference, latestReference])
    })

    test("moves repeated references to the end when adding a history item", () => {
        const oldReference = { id: "primary", book: 43, chapter: 3, verse: [16], reference: "John 3:16", text: "old" }
        const otherReference = { id: "primary", book: 19, chapter: 23, verse: [1], reference: "Psalm 23:1", text: "other" }
        const latestReference = { id: "secondary", book: 43, chapter: 3, verse: [16], reference: "John 3:16", text: "latest" }

        expect(addScriptureHistoryItem([oldReference, otherReference], latestReference)).toEqual([otherReference, latestReference])
    })

    test("skips incomplete entries and respects the requested limit", () => {
        const invalidReference = { id: "primary", reference: "Missing selection" }
        const firstReference = { id: "primary", book: 40, chapter: 5, verse: [9], reference: "Matthew 5:9", text: "first" }
        const secondReference = { id: "primary", book: 45, chapter: 8, verse: [28], reference: "Romans 8:28", text: "second" }

        expect(getRecentScriptureHistory([invalidReference, firstReference, secondReference], 1)).toEqual([secondReference])
    })
})
