import type { RyuJsonValue } from "@ryu/app-host/json-values";
import type { Stroke, Tool } from "drawesome";
import { z } from "zod";

export const DRAWESOME_STORAGE_NAMESPACE = "drawesome";
export const DRAWESOME_STORAGE_KEY = "sketch.v1";
export const DEFAULT_SKETCH_TITLE = "Untitled sketch";
export const MAX_STROKES = 5000;
export type SketchTool = "pen" | "highlighter" | "eraser";

export interface DrawesomeSnapshot {
	strokes: Stroke[];
	title: string;
}

const titleSchema = z.string();
const strokeSchema = z.looseObject({
	id: z.number().int().safe(),
	pen: z.enum([
		"pencil",
		"pen",
		"fineliner",
		"marker",
		"highlighter",
		"brush",
		"fountain",
	]),
	color: z.string(),
	size: z.number().finite().positive(),
	opacity: z.number().finite().min(0).max(1),
	points: z.array(
		z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
	),
	shape: z
		.looseObject({
			nibAngle: z.number().finite().optional(),
			taper: z.number().finite().optional(),
			simulatePressure: z.boolean().optional(),
		})
		.optional(),
	erase: z.boolean().optional(),
});
const snapshotSchema = z.object({
	title: z.string().optional(),
	strokes: z.array(z.json()).optional(),
});
type SketchModelInput = RyuJsonValue | Stroke | Stroke[] | undefined;

export function normalizeTitle(value: SketchModelInput): string {
	const parsed = titleSchema.safeParse(value);
	if (!parsed.success) {
		return DEFAULT_SKETCH_TITLE;
	}
	return parsed.data.trim().slice(0, 120) || DEFAULT_SKETCH_TITLE;
}
export function normalizeStrokes(value: SketchModelInput): Stroke[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const strokes: Stroke[] = [];
	for (const candidate of value) {
		const parsed = strokeSchema.safeParse(candidate);
		if (parsed.success) {
			strokes.push(parsed.data);
		}
	}
	return strokes.slice(-MAX_STROKES);
}

export function emptySnapshot(): DrawesomeSnapshot {
	return { title: DEFAULT_SKETCH_TITLE, strokes: [] };
}

export function createDrawingTool(
	tool: SketchTool,
	color: string,
	size: number
): Tool {
	if (tool === "eraser") {
		return { kind: "eraser", size };
	}
	return {
		kind: "pen",
		pen: tool === "highlighter" ? "marker" : "pen",
		color,
		size,
		opacity: tool === "highlighter" ? 0.42 : 1,
	};
}

export function parseSnapshot(value: SketchModelInput): DrawesomeSnapshot {
	const parsed = snapshotSchema.safeParse(value);
	if (!parsed.success) {
		return emptySnapshot();
	}
	return {
		title: normalizeTitle(parsed.data.title),
		strokes: normalizeStrokes(parsed.data.strokes),
	};
}

export function serializeSnapshot(snapshot: DrawesomeSnapshot): string {
	return JSON.stringify({
		version: 1,
		title: normalizeTitle(snapshot.title),
		strokes: normalizeStrokes(snapshot.strokes),
	});
}
