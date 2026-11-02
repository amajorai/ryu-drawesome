import { describe, expect, test } from "bun:test";
import { dataUrlByteLength } from "./App-export.ts";

function pngDataUrl(bytes: number[]): string {
	return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

describe("dataUrlByteLength", () => {
	test("reports the decoded byte count for every base64 padding length", () => {
		for (const length of [1, 2, 3, 4, 5, 6, 37, 38_573]) {
			const bytes = Array.from({ length }, (_, index) => index % 256);
			expect(dataUrlByteLength(pngDataUrl(bytes))).toBe(length);
		}
	});
});
