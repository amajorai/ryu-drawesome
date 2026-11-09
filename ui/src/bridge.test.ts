import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { loadSnapshot, notify, saveSnapshot } from "./bridge.ts";
import type { DrawesomeSnapshot } from "./model.ts";

const hadWindow = "window" in globalThis;
const originalWindow = globalThis.window;
const ownsRegistration = !GlobalRegistrator.isRegistered;
if (ownsRegistration) {
	GlobalRegistrator.register();
}
const NativeWindow = globalThis.Window;
const nativeWindows: Window[] = [];
afterAll(() => {
	if (ownsRegistration) {
		GlobalRegistrator.unregister();
	}
});
function nativeWindow(host?: Window["ryu"]): Window {
	const value: Window = Reflect.construct(NativeWindow, [
		{ url: "http://drawesome.test/native" },
	]);
	nativeWindows.push(value);
	if (host) {
		Object.defineProperty(value, "ryu", { configurable: true, value: host });
	}
	return value;
}

afterEach(async () => {
	for (const value of nativeWindows.splice(0)) {
		value.close();
	}
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
			value: nativeWindow({
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
			}),
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

	test("refuses a live host without the granted storage bridge", async () => {
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: nativeWindow({}),
			writable: true,
		});

		await expect(loadSnapshot()).rejects.toThrow(
			"Sketch storage is unavailable on this host."
		);
		await expect(
			saveSnapshot({ title: "Unsaved", strokes: [] })
		).rejects.toThrow("Sketch storage is unavailable on this host.");
	});

	test("does not fall back to browser data after a live storage refusal", async () => {
		let localReads = 0;
		const browser = nativeWindow({
			storage: {
				get: async () => {
					throw new Error("permission denied");
				},
				set: async () => undefined,
			},
		});
		Object.defineProperty(browser.localStorage, "getItem", {
			value: () => {
				localReads++;
				return '{"title":"stale browser copy","strokes":[]}';
			},
		});
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: browser,
			writable: true,
		});

		await expect(loadSnapshot()).rejects.toThrow(
			"Sketch storage could not be loaded. Reload before editing."
		);
		expect(localReads).toBe(0);
	});

	test("reports a browser persistence refusal instead of claiming a save", async () => {
		const browser = nativeWindow();
		Object.defineProperty(browser.localStorage, "setItem", {
			value: () => {
				throw new Error("quota exceeded");
			},
		});
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: browser,
			writable: true,
		});

		await expect(
			saveSnapshot({ title: "Memory only", strokes: [] })
		).rejects.toThrow("Browser sketch storage is unavailable.");
	});

	test("keeps optional toast failures from masking inline feedback", async () => {
		type ToastInput = Parameters<
			NonNullable<
				NonNullable<NonNullable<Window["ryu"]>["ui"]>["toast"]
			>["show"]
		>[0];
		const calls: ToastInput[] = [];
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: nativeWindow({
				ui: {
					toast: {
						show: async (input: ToastInput) => {
							calls.push(input);
							throw new Error("toast unavailable");
						},
					},
				},
			}),
			writable: true,
		});

		await expect(notify("Saved", "success")).resolves.toBeUndefined();
		expect(calls).toEqual([{ title: "Saved", variant: "success" }]);
	});
});
