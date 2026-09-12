import type { Stroke } from "drawesome";

export const DRAWESOME_STORAGE_NAMESPACE = "drawesome";
export const DRAWESOME_STORAGE_KEY = "sketch.v1";
export const DEFAULT_SKETCH_TITLE = "Untitled sketch";
export const MAX_STROKES = 5000;

const PEN_IDS = new Set<Stroke["pen"]>([
	"pencil",
	"pen",
	"fineliner",
	"marker",
	"highlighter",
	"brush",
	"fountain",
]);

export interface DrawesomeSnapshot {
	strokes: Stroke[];
	title: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isPoint(value: unknown): boolean {
	return (
		Array.isArray(value) &&
		value.length >= 2 &&
		value.every(
			(component) => typeof component === "number" && Number.isFinite(component)
		)
	);
}

function isStroke(value: unknown): value is Stroke {
	if (!isRecord(value)) {
		return false;
	}
	return (
		typeof value.id === "number" &&
		Number.isSafeInteger(value.id) &&
		typeof value.pen === "string" &&
		PEN_IDS.has(value.pen as Stroke["pen"]) &&
		typeof value.color === "string" &&
		typeof value.size === "number" &&
		Number.isFinite(value.size) &&
		value.size > 0 &&
		typeof value.opacity === "number" &&
		Number.isFinite(value.opacity) &&
		value.opacity >= 0 &&
		value.opacity <= 1 &&
		Array.isArray(value.points) &&
		value.points.every(isPoint) &&
		(value.erase === undefined || typeof value.erase === "boolean")
	);
}

export function normalizeTitle(value: unknown): string {
	if (typeof value !== "string") {
		return DEFAULT_SKETCH_TITLE;
	}
	const title = value.trim().slice(0, 120);
	return title || DEFAULT_SKETCH_TITLE;
}

export function normalizeStrokes(value: unknown): Stroke[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter(isStroke).slice(-MAX_STROKES);
}

export function emptySnapshot(): DrawesomeSnapshot {
	return { title: DEFAULT_SKETCH_TITLE, strokes: [] };
}

export function parseSnapshot(value: unknown): DrawesomeSnapshot {
	if (!isRecord(value)) {
		return emptySnapshot();
	}
	return {
		title: normalizeTitle(value.title),
		strokes: normalizeStrokes(value.strokes),
	};
}

export function serializeSnapshot(snapshot: DrawesomeSnapshot): string {
	return JSON.stringify({
		version: 1,
		title: normalizeTitle(snapshot.title),
		strokes: normalizeStrokes(snapshot.strokes),
	});
}
