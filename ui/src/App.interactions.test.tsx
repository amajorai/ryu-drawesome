import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { Root } from "react-dom/client";
import { DRAWESOME_STORAGE_KEY, DRAWESOME_STORAGE_NAMESPACE } from "./model.ts";

if (!GlobalRegistrator.isRegistered) {
	GlobalRegistrator.register();
}
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: App } = await import("./App.tsx");

interface DownloadCapture {
	blob?: Blob;
	filename: string;
}

interface MountedApp {
	container: HTMLDivElement;
	root: Root;
}

const mountedApps: MountedApp[] = [];
let originalCreateObjectUrl: typeof URL.createObjectURL | undefined;
let originalAnchorClick: ((this: HTMLAnchorElement) => void) | undefined;
let originalBoundingClientRect:
	| typeof Element.prototype.getBoundingClientRect
	| undefined;
const storageKey = `${DRAWESOME_STORAGE_NAMESPACE}:${DRAWESOME_STORAGE_KEY}`;

async function tick(delay = 0): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, delay));
}

async function mountApp(): Promise<HTMLDivElement> {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	mountedApps.push({ container, root });
	await act(async () => {
		root.render(<App />);
		await tick();
	});
	return container;
}

async function setInputValue(
	container: HTMLElement,
	value: string
): Promise<void> {
	const input = container.querySelector<HTMLInputElement>(
		'input[aria-label="Sketch title"]'
	);
	if (!input) {
		throw new Error("Could not find the sketch title input.");
	}
	await act(async () => {
		input.focus();
		const setter = Object.getOwnPropertyDescriptor(
			Object.getPrototypeOf(input),
			"value"
		)?.set;
		if (setter) {
			setter.call(input, value);
		} else {
			input.value = value;
		}
		input.dispatchEvent(new Event("input", { bubbles: true }));
		await tick();
	});
}

function pointerEvent(
	type: string,
	options: { clientX: number; clientY: number }
): Event {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		clientX: { value: options.clientX },
		clientY: { value: options.clientY },
		pointerId: { value: 7 },
		pointerType: { value: "mouse" },
		pressure: { value: 0.5 },
	});
	return event;
}

async function clickButton(
	container: HTMLElement,
	ariaLabel: string
): Promise<void> {
	const button = container.querySelector<HTMLButtonElement>(
		`button[aria-label="${ariaLabel}"]`
	);
	if (!button) {
		throw new Error(`Could not find Drawesome button: ${ariaLabel}`);
	}
	await act(async () => {
		button.click();
		await tick();
	});
}

afterEach(async () => {
	for (const { container, root } of mountedApps.splice(0)) {
		await act(async () => root.unmount());
		container.remove();
	}
	if (originalCreateObjectUrl) {
		URL.createObjectURL = originalCreateObjectUrl;
		originalCreateObjectUrl = undefined;
	}
	if (originalAnchorClick) {
		HTMLAnchorElement.prototype.click = originalAnchorClick;
		originalAnchorClick = undefined;
	}
	if (originalBoundingClientRect) {
		Element.prototype.getBoundingClientRect = originalBoundingClientRect;
		originalBoundingClientRect = undefined;
	}
	localStorage.removeItem(storageKey);
});

describe("Drawesome rendered sketch workflow", () => {
	test("draws a stroke, saves the title and path locally, exports SVG bytes, and starts a new sketch", async () => {
		localStorage.removeItem(storageKey);
		const download: DownloadCapture = { filename: "" };
		originalCreateObjectUrl = URL.createObjectURL;
		URL.createObjectURL = (blob: Blob) => {
			download.blob = blob;
			return "blob:drawesome-fixture";
		};
		originalAnchorClick = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function captureDownload() {
			download.filename = this.download;
		};
		// Happy DOM has no layout. The production board measures its parent,
		// while DrawSurface maps pointer coordinates using its own SVG rectangle.
		const previousBoundingClientRect = Element.prototype.getBoundingClientRect;
		originalBoundingClientRect = previousBoundingClientRect;
		Element.prototype.getBoundingClientRect = function measuredDrawingArea() {
			if (!this.matches(".drawesome-paper, .drawesome-drawing-surface")) {
				return previousBoundingClientRect.call(this);
			}
			return new DOMRect(0, 0, 1600, 1000);
		};

		const container = await mountApp();
		await setInputValue(container, "Launch / review");
		const surface = container.querySelector<SVGSVGElement>(
			".drawesome-paper svg"
		);
		expect(surface).not.toBeNull();
		if (!surface) {
			throw new Error("Drawesome did not mount its SVG drawing surface.");
		}
		expect(surface.getAttribute("viewBox")).toBe("0 0 1600 1000");

		await act(async () => {
			surface.dispatchEvent(
				pointerEvent("pointerdown", { clientX: 40, clientY: 60 })
			);
			surface.dispatchEvent(
				pointerEvent("pointermove", { clientX: 100, clientY: 110 })
			);
			surface.dispatchEvent(
				pointerEvent("pointermove", { clientX: 150, clientY: 160 })
			);
			surface.dispatchEvent(
				pointerEvent("pointerup", { clientX: 150, clientY: 160 })
			);
			await tick();
		});
		await act(async () => tick(750));

		const savedValue = localStorage.getItem(storageKey);
		expect(savedValue).not.toBeNull();
		const saved = JSON.parse(savedValue ?? "");
		expect(saved).toMatchObject({
			title: "Launch / review",
			version: 1,
		});
		expect(saved.strokes).toHaveLength(1);
		expect(saved.strokes[0]?.points).toEqual([
			[40, 60, 0.5],
			[100, 110, 0.5],
			[150, 160, 0.5],
		]);
		expect(container.textContent).toContain("Saved in this browser");

		await clickButton(container, "Export sketch as SVG");
		expect(download.filename).toBe("launch-review.svg");
		expect(download.blob).toBeInstanceOf(Blob);
		if (!download.blob) {
			throw new Error("Drawesome did not provide its exported SVG blob.");
		}
		const svgBytes = await download.blob.text();
		expect(svgBytes).toContain("<svg");
		expect(svgBytes).toContain("<path");
		expect(container.textContent).toContain("Exported SVG copy");

		await clickButton(container, "Start a new sketch");
		await act(async () => tick(750));
		const fresh = JSON.parse(localStorage.getItem(storageKey) ?? "");
		expect(fresh).toEqual({
			title: "Untitled sketch",
			strokes: [],
			version: 1,
		});
	});
});
