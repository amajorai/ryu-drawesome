import { afterEach, describe, expect, test } from "bun:test";
import { loadSnapshot, saveSnapshot } from "./bridge";
import type { DrawesomeSnapshot } from "./model";

const hadWindow = "window" in globalThis;
const originalWindow = globalThis.window;

afterEach(() => {
	if (hadWindow) {
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: originalWindow,
			writable: true,
		});
	} else {
		Reflect.deleteProperty(globalThis, "window");
	}
});

describe("Drawesome host bridge", () => {
	test("loads and saves through the app-scoped Ryu storage contract", async () => {
		const calls: Array<{ key: string; namespace?: string; value?: string }> =
			[];
		const stored = JSON.stringify({
			title: "Bridge sketch",
			strokes: [],
			version: 1,
		});
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: {
				ryu: {
					storage: {
						get: async (input: { key: string; namespace?: string }) => {
							calls.push(input);
							return stored;
						},
						set: async (input: {
							key: string;
							namespace?: string;
							value: string;
						}) => {
							calls.push(input);
						},
					},
				},
			} as Window,
			writable: true,
		});

		const loaded = await loadSnapshot();
		const snapshot: DrawesomeSnapshot = { title: "Saved sketch", strokes: [] };
		await saveSnapshot(snapshot);

		expect(loaded.mode).toBe("live");
		expect(loaded.snapshot.title).toBe("Bridge sketch");
		expect(calls).toEqual([
			{ key: "sketch.v1", namespace: "drawesome" },
			{
				key: "sketch.v1",
				namespace: "drawesome",
				value: '{"version":1,"title":"Saved sketch","strokes":[]}',
			},
		]);
	});
});
