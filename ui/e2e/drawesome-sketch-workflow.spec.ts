import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

type DrawesomeStorage = NonNullable<NonNullable<Window["ryu"]>["storage"]>;
interface DrawesomeDialogCall {
	method: "get" | "set";
	value:
		| Parameters<DrawesomeStorage["get"]>[0]
		| Parameters<DrawesomeStorage["set"]>[0];
}
declare global {
	interface Window {
		__drawesomeDialogCalls?: DrawesomeDialogCall[];
		__drawesomeDialogMessages?: MessageEvent["data"][];
	}
}

async function screenshotPath(name: string) {
	const configured = process.env.RYU_APPS_STORE_PROOF_DIR;
	const destination = configured
		? path.join(configured, name)
		: path.join(import.meta.dirname, "evidence", name);
	await mkdir(path.dirname(destination), { recursive: true });
	return destination;
}

async function openSketchDialog(page: Page) {
	await page.addInitScript(() => {
		if (window.parent === window) {
			return;
		}
		const child = window;
		const calls: DrawesomeDialogCall[] = [];
		Object.defineProperty(child, "__drawesomeDialogCalls", {
			configurable: true,
			value: calls,
		});
		Object.defineProperty(child, "ryu", {
			configurable: true,
			value: {
				context: { mode: "sketch-dialog", token: "dialog-fixture-token" },
				storage: {
					get: async (input: { key: string; namespace?: string }) => {
						calls.push({ method: "get", value: input });
						return null;
					},
					set: async (input: {
						key: string;
						namespace?: string;
						value: string;
					}) => {
						calls.push({ method: "set", value: input });
					},
				},
				ui: { toast: { show: async () => "drawesome-fixture-toast" } },
			},
		});
	});
	await page.goto("/");
	await page.evaluate(() => {
		const parent = window;
		parent.__drawesomeDialogMessages = [];
		function isNativeObject(value: MessageEvent["data"]): boolean {
			if (value === null) {
				return true;
			}
			const boxedValue = new Object(value);
			if (boxedValue !== value) {
				return false;
			}
			try {
				Function.prototype.toString.call(value);
				return false;
			} catch {
				return true;
			}
		}
		window.addEventListener("message", (event: MessageEvent) => {
			if (
				isNativeObject(event.data) &&
				event.data !== null &&
				event.data.kind === "ryu-drawesome-dialog"
			) {
				parent.__drawesomeDialogMessages?.push(event.data);
			}
		});
		const frame = document.createElement("iframe");
		frame.dataset.testid = "drawesome-dialog-frame";
		frame.title = "Sketch attachment fixture";
		Object.assign(frame.style, {
			border: "0",
			height: "100%",
			inset: "0",
			position: "fixed",
			width: "100%",
			zIndex: "1000",
		});
		frame.src = "/?sketch-dialog-fixture=1";
		document.body.append(frame);
	});
	const frame = page.frameLocator(
		'iframe[data-testid="drawesome-dialog-frame"]'
	);
	await expect(frame.getByTestId("drawesome-sketch-dialog")).toBeVisible();
	return frame;
}

test("Drawesome draws, saves locally, and exports the exact SVG file", async ({
	page,
}, testInfo) => {
	const browserErrors: string[] = [];
	page.on("pageerror", (error) => browserErrors.push(error.message));
	await page.goto("/");
	await expect(page.getByTestId("drawesome-save-state")).toHaveAttribute(
		"aria-label",
		"Sketch ready"
	);
	await page.getByLabel("Sketch title").fill("Launch / review");

	const surface = page.locator("svg.drawesome-drawing-surface");
	const box = await surface.boundingBox();
	expect(box).not.toBeNull();
	if (!box) {
		throw new Error("Drawesome's production SVG surface is not visible.");
	}
	await page.mouse.move(box.x + 40, box.y + 60);
	await page.mouse.down();
	await page.mouse.move(box.x + 100, box.y + 110, { steps: 3 });
	await page.mouse.move(box.x + 150, box.y + 160, { steps: 3 });
	await page.mouse.up();
	await expect(page.getByTestId("drawesome-save-state")).toHaveAttribute(
		"aria-label",
		"Sketch saved"
	);
	// Actual DrawSurface pointer input commits drawing-instance strokes to persisted storage.
	const storageKey = "drawesome:sketch.v1";
	await expect
		.poll(() =>
			page.evaluate((key) => {
				const value = localStorage.getItem(key);
				return value ? JSON.parse(value) : null;
			}, storageKey)
		)
		.toMatchObject({
			title: "Launch / review",
			version: 1,
			strokes: [expect.objectContaining({ pen: "pen" })],
		});

	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export sketch as SVG" }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe("launch-review.svg");
	const svgPath = testInfo.outputPath(download.suggestedFilename());
	await mkdir(path.dirname(svgPath), { recursive: true });
	await download.saveAs(svgPath);
	const svgBytes = await readFile(svgPath, "utf8");
	expect(svgBytes).toContain("<svg");
	expect(svgBytes).toContain("<path");
	await expect(
		page.getByRole("status").filter({ hasText: /^Exported SVG copy$/u })
	).toHaveText("Exported SVG copy");

	const pngDownloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export sketch as PNG" }).click();
	const pngDownload = await pngDownloadPromise;
	expect(pngDownload.suggestedFilename()).toBe("launch-review.png");
	const pngPath = testInfo.outputPath(pngDownload.suggestedFilename());
	await mkdir(path.dirname(pngPath), { recursive: true });
	await pngDownload.saveAs(pngPath);
	const pngBytes = await readFile(pngPath);
	expect([...pngBytes.subarray(0, 8)]).toEqual([
		137, 80, 78, 71, 13, 10, 26, 10,
	]);
	expect(pngBytes.readUInt32BE(16)).toBeGreaterThan(0);
	expect(pngBytes.readUInt32BE(20)).toBeGreaterThan(0);
	await expect(
		page.getByRole("status").filter({ hasText: /^Exported PNG copy$/u })
	).toHaveText("Exported PNG copy");
	// Export PNG downloads a valid local PNG with actual dimensions and rendered-export status.
	expect(browserErrors).toEqual([]);
	await page.screenshot({
		animations: "disabled",
		fullPage: true,
		path: await screenshotPath("drawesome-saved-sketch-exported.png"),
	});
});

test("sketch dialog drawing attaches the rendered PNG through the tokenized host message", async ({
	page,
}) => {
	const browserErrors: string[] = [];
	page.on("pageerror", (error) => browserErrors.push(error.message));
	const frame = await openSketchDialog(page);
	const attachButton = frame.getByRole("button", { name: "Attach sketch" });
	await expect(attachButton).toBeDisabled();
	const surface = frame.locator("svg.drawesome-drawing-surface");
	const box = await surface.boundingBox();
	expect(box).not.toBeNull();
	if (!box) {
		throw new Error("Drawesome's sketch-dialog surface is not visible.");
	}
	await page.mouse.move(box.x + 35, box.y + 45);
	await page.mouse.down();
	await page.mouse.move(box.x + 95, box.y + 95, { steps: 3 });
	await page.mouse.move(box.x + 145, box.y + 125, { steps: 3 });
	await page.mouse.up();
	// Pointer input commits drawing-instance strokes and unlocks a real attachment.
	await expect(attachButton).toBeEnabled();
	await attachButton.click();
	await expect
		.poll(() =>
			page.evaluate(() => window.__drawesomeDialogMessages?.length ?? 0)
		)
		.toBe(1);
	const messages = await page.evaluate(
		() => window.__drawesomeDialogMessages ?? []
	);
	expect(messages).toHaveLength(1);
	const message = messages[0];
	// Attach posts the rendered PNG bytes to the tokenized host bridge.
	expect(message).toMatchObject({
		action: "attach",
		kind: "ryu-drawesome-dialog",
		token: "dialog-fixture-token",
	});
	expect(message?.file).toMatchObject({
		filename: "sketch.png",
		mimeType: "image/png",
	});
	const dataUrl = message?.file?.dataUrl;
	expect(dataUrl).toMatch(/^data:image\/png;base64,/u);
	if (!dataUrl) {
		throw new Error("The attach message did not contain PNG data.");
	}
	const pngBytes = Buffer.from(
		dataUrl.slice("data:image/png;base64,".length),
		"base64"
	);
	expect([...pngBytes.subarray(0, 8)]).toEqual([
		137, 80, 78, 71, 13, 10, 26, 10,
	]);
	expect(message?.file?.size).toBe(pngBytes.byteLength);
	expect(pngBytes.readUInt32BE(16)).toBeGreaterThan(0);
	expect(pngBytes.readUInt32BE(20)).toBeGreaterThan(0);
	const dialogCalls = await frame
		.locator("body")
		.evaluate(() => window.__drawesomeDialogCalls ?? []);
	expect(dialogCalls.filter((call) => call.method === "set")).toEqual([]);
	await page.screenshot({
		animations: "disabled",
		fullPage: true,
		path: await screenshotPath("drawesome-dialog-png-attached.png"),
	});
	expect(browserErrors).toEqual([]);
});

test("sketch dialog Close sketch sends a close action without creating an attachment", async ({
	page,
}) => {
	const frame = await openSketchDialog(page);
	await expect(
		frame.getByRole("button", { name: "Attach sketch" })
	).toBeDisabled();
	await frame
		.getByRole("button", { name: "Close sketch", exact: true })
		.click();
	await expect
		.poll(() =>
			page.evaluate(() => window.__drawesomeDialogMessages?.length ?? 0)
		)
		.toBe(1);
	const messages = await page.evaluate(
		() => window.__drawesomeDialogMessages ?? []
	);
	// Close sketch closes the host dialog with its capability token and no image payload.
	expect(messages).toEqual([
		{
			action: "close",
			kind: "ryu-drawesome-dialog",
			token: "dialog-fixture-token",
		},
	]);
});
