import { describe, expect, test } from "bun:test";
import type { Stroke } from "drawesome";
import {
	createDrawingTool,
	DEFAULT_SKETCH_TITLE,
	emptySnapshot,
	normalizeStrokes,
	normalizeTitle,
	parseSnapshot,
	serializeSnapshot,
} from "./model.ts";

const stroke: Stroke = {
	color: "#111111",
	id: 1,
	pen: "pen",
	points: [[1, 2, 1]],
	size: 3,
	opacity: 1,
};
const secondStroke: Stroke = {
	color: "#111111",
	id: 2,
	pen: "pen",
	points: [],
	size: 3,
	opacity: 1,
};

describe("Drawesome snapshot model", () => {
	test("keeps a usable title and only stroke-shaped values", () => {
		expect(normalizeTitle("  Notes  ")).toBe("Notes");
		expect(normalizeTitle("   ")).toBe(DEFAULT_SKETCH_TITLE);
		expect(
			normalizeStrokes([stroke, null, secondStroke, { points: [] }, "bad"])
		).toEqual([stroke, secondStroke]);
	});

	test("validates native pressure tuples and stroke shape while retaining extension fields", () => {
		const nativeStroke = {
			...stroke,
			points: [[2, 3, 0.5]] satisfies Stroke["points"],
			shape: { nibAngle: 30, taper: 0.5, simulatePressure: true },
			label: "ink",
		};
		expect(normalizeStrokes([nativeStroke])).toEqual([nativeStroke]);
		expect(
			normalizeStrokes([
				{ ...stroke, points: [[2, 3]] },
				{ ...stroke, points: [[2, 3, Number.NaN]] },
				{ ...stroke, shape: { simulatePressure: "yes" } },
				{ ...stroke, opacity: 2 },
			])
		).toEqual([]);
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

	test("maps the compact tools to visible ink on a dark canvas", () => {
		expect(createDrawingTool("pen", "#f5f5f5", 4)).toEqual({
			kind: "pen",
			pen: "pen",
			color: "#f5f5f5",
			size: 4,
			opacity: 1,
		});
		expect(createDrawingTool("highlighter", "#ffbf3f", 8)).toEqual({
			kind: "pen",
			pen: "marker",
			color: "#ffbf3f",
			size: 8,
			opacity: 0.42,
		});
		expect(createDrawingTool("eraser", "#f5f5f5", 12)).toEqual({
			kind: "eraser",
			size: 12,
		});
	});
});
