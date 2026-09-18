import { describe, expect, test } from "bun:test";
import type { Stroke } from "drawesome";
import {
	DEFAULT_SKETCH_TITLE,
	emptySnapshot,
	normalizeStrokes,
	normalizeTitle,
	parseSnapshot,
	serializeSnapshot,
} from "./model";

const stroke: Stroke = {
	color: "#111111",
	id: 1,
	pen: "pen",
	points: [[1, 2, 1]],
	size: 3,
	opacity: 1,
};
const secondStroke = {
	color: "#111111",
	id: 2,
	pen: "pen",
	points: [],
	size: 3,
	opacity: 1,
} as Stroke;

describe("Drawesome snapshot model", () => {
	test("keeps a usable title and only stroke-shaped values", () => {
		expect(normalizeTitle("  Notes  ")).toBe("Notes");
		expect(normalizeTitle("   ")).toBe(DEFAULT_SKETCH_TITLE);
		expect(
			normalizeStrokes([stroke, null, secondStroke, { points: [] }, "bad"])
		).toEqual([stroke, secondStroke]);
	});

	test("parses malformed storage into an empty sketch", () => {
		expect(parseSnapshot(null)).toEqual(emptySnapshot());
		expect(parseSnapshot({ title: "Board", strokes: [stroke, 4] })).toEqual({
			title: "Board",
			strokes: [stroke],
		});
	});

	test("serializes a versioned, bounded snapshot", () => {
		expect(
			JSON.parse(serializeSnapshot({ title: "Board", strokes: [stroke] }))
		).toEqual({
			version: 1,
			title: "Board",
			strokes: [stroke],
		});
	});
});
