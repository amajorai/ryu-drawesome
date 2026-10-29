import type { Board, DrawingController, Stroke, Tool } from "drawesome";
import { DrawSurface, toPng, toSvg, useDrawing } from "drawesome";
import "drawesome/styles.css";
import { Button } from "@ryu/ui/components/button.tsx";
import { Input } from "@ryu/ui/components/input.tsx";
import { safeMediaUrl } from "@ryu/ui/lib/safe-media-url.ts";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawesomeMode } from "./bridge.ts";
import { loadSnapshot, notify, saveSnapshot } from "./bridge.ts";
import type { SketchTool } from "./model.ts";
import {
	createDrawingTool,
	DEFAULT_SKETCH_TITLE,
	emptySnapshot,
	normalizeTitle,
} from "./model.ts";
import "./drawesome.css";

type SaveState = "idle" | "saving" | "saved" | "error";
type ExportFormat = "png" | "svg";
type SketchIconName =
	| "pen"
	| "highlighter"
	| "eraser"
	| "undo"
	| "redo"
	| "close"
	| "attach"
	| "new"
	| "svg"
	| "image";

const SAVE_LABEL = {
	idle: "Ready",
	saving: "Saving…",
	saved: "Saved",
	error: "Local copy only",
} satisfies Record<SaveState, string>;

const DRAW_SWATCHES = [
	"#f5f5f5",
	"#8b8b8b",
	"#9a5a32",
	"#dc3f3f",
	"#f36a32",
	"#f5a623",
	"#389b57",
	"#318f82",
	"#43b4ca",
	"#496cdd",
	"#7954d8",
	"#bd3e8b",
];
const DEFAULT_INK = "#f5f5f5";

function SketchIcon({ name }: { name: SketchIconName }) {
	let paths: ReactNode;
	switch (name) {
		case "pen":
			paths = <path d="m4 20 4-.9L19 8l-3-3L5 16l-1 4ZM14 7l3 3" />;
			break;
		case "highlighter":
			paths = (
				<>
					<path d="m8 14 7.5-7.5 4 4L12 18" />
					<path d="m5 19 7-1M4 21h15" />
				</>
			);
			break;
		case "eraser":
			paths = (
				<>
					<path d="m7.5 4.5 12 12-4 4-12-12 4-4Z" />
					<path d="m11.5 8.5-8 8 4 4h8" />
				</>
			);
			break;
		case "undo":
			paths = (
				<>
					<path d="M9 14 4 9l5-5" />
					<path d="M4.5 9H14a6 6 0 1 1 0 12h-2" />
				</>
			);
			break;
		case "redo":
			paths = (
				<>
					<path d="m15 14 5-5-5-5" />
					<path d="M19.5 9H10a6 6 0 1 0 0 12h2" />
				</>
			);
			break;
		case "close":
			paths = <path d="m6 6 12 12M18 6 6 18" />;
			break;
		case "attach":
			paths = <path d="m5 12 4.5 4.5L19 7" />;
			break;
		case "new":
			paths = <path d="M12 5v14M5 12h14" />;
			break;
		case "svg":
			paths = <path d="M5 4h10l4 4v12H5zM14 4v5h5M8 14h8M8 17h5" />;
			break;
		case "image":
			paths = (
				<>
					<rect height="14" rx="2" width="18" x="3" y="5" />
					<path d="m4 16 5-5 4 4 3-3 5 5M8 9h.01" />
				</>
			);
			break;
	}

	return (
		<svg
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.7"
			viewBox="0 0 24 24"
		>
			{paths}
		</svg>
	);
}

function SketchHistoryControls({
	drawing,
	floating = false,
}: {
	drawing: DrawingController;
	floating?: boolean;
}) {
	return (
		<div
			aria-label="History"
			className={
				floating
					? "drawesome-history-group drawesome-history-floating"
					: "drawesome-history-group"
			}
			role="group"
		>
			<Button
				aria-label="Undo"
				disabled={!drawing.canUndo}
				onClick={drawing.undo}
				size="icon-sm"
				title="Undo"
				variant="ghost"
			>
				<SketchIcon name="undo" />
			</Button>
			<Button
				aria-label="Redo"
				disabled={!drawing.canRedo}
				onClick={drawing.redo}
				size="icon-sm"
				title="Redo"
				variant="ghost"
			>
				<SketchIcon name="redo" />
			</Button>
		</div>
	);
}

function SketchToolDock({
	drawing,
	activeTool,
	onToolChange,
	showHistory = true,
}: {
	drawing: DrawingController;
	activeTool: SketchTool;
	onToolChange: (tool: SketchTool) => void;
	showHistory?: boolean;
}) {
	const tools: Array<{ id: SketchTool; label: string }> = [
		{ id: "pen", label: "Pen" },
		{ id: "highlighter", label: "Highlighter" },
		{ id: "eraser", label: "Eraser" },
	];

	return (
		<div
			aria-label="Sketch tools"
			className="drawesome-tool-dock"
			data-testid="drawesome-tool-dock"
			role="toolbar"
		>
			<div
				aria-label="Drawing tools"
				className="drawesome-tool-group"
				role="group"
			>
				{tools.map(({ id, label }) => (
					<Button
						aria-label={label}
						aria-pressed={activeTool === id}
						data-active={activeTool === id || undefined}
						key={id}
						onClick={() => onToolChange(id)}
						size="icon-sm"
						title={label}
						variant={activeTool === id ? "secondary" : "ghost"}
					>
						<SketchIcon name={id} />
					</Button>
				))}
			</div>
			{showHistory ? (
				<>
					<span aria-hidden="true" className="drawesome-tool-divider" />
					<SketchHistoryControls drawing={drawing} />
				</>
			) : null}
		</div>
	);
}

declare module "react" {
	interface CSSProperties {
		"--ink"?: string;
	}
}

function SketchPalette({
	color,
	onColorChange,
}: {
	color: string;
	onColorChange: (color: string) => void;
}) {
	return (
		<div aria-label="Ink color" className="drawesome-palette" role="group">
			<label className="drawesome-custom-color" title="Choose a custom color">
				<span aria-hidden="true" className="drawesome-custom-color-mark" />
				<input
					aria-label="Choose a custom ink color"
					className="drawesome-custom-color-input"
					onChange={(event) => onColorChange(event.target.value)}
					type="color"
					value={color}
				/>
			</label>
			{DRAW_SWATCHES.map((swatch) => (
				<Button
					aria-label={`Ink ${swatch}`}
					aria-pressed={color.toLowerCase() === swatch.toLowerCase()}
					data-active={
						color.toLowerCase() === swatch.toLowerCase() || undefined
					}
					key={swatch}
					onClick={() => onColorChange(swatch)}
					size="icon-xs"
					title={swatch}
					variant={
						color.toLowerCase() === swatch.toLowerCase() ? "secondary" : "ghost"
					}
				>
					<span className="drawesome-ink-sample" style={{ "--ink": swatch }} />
				</Button>
			))}
		</div>
	);
}

function BrushSizeControl({
	size,
	onSizeChange,
}: {
	size: number;
	onSizeChange: (size: number) => void;
}) {
	return (
		<label className="drawesome-size-control">
			<span className="sr-only">Brush size</span>
			<input
				aria-label="Brush size"
				max="32"
				min="1"
				onChange={(event) => onSizeChange(Number(event.target.value))}
				step="1"
				title={`Brush size ${size}`}
				type="range"
				value={size}
			/>
		</label>
	);
}

function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}

function safeFileName(title: string): string {
	const cleaned = title
		.trim()
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return cleaned || "untitled-sketch";
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () =>
			reject(reader.error ?? new Error("Could not read sketch"));
		reader.readAsDataURL(blob);
	});
}

function loadImage(source: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("Could not load reference image"));
		image.src = source;
	});
}

async function compositeReferenceImage(
	overlay: Blob,
	referenceUrl: string
): Promise<string> {
	const [overlayUrl, reference] = await Promise.all([
		blobToDataUrl(overlay),
		loadImage(referenceUrl),
	]);
	const overlayImage = await loadImage(overlayUrl);
	const canvas = document.createElement("canvas");
	canvas.width = overlayImage.naturalWidth;
	canvas.height = overlayImage.naturalHeight;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Could not prepare annotation canvas");
	}
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, canvas.width, canvas.height);
	const scale = Math.min(
		canvas.width / reference.naturalWidth,
		canvas.height / reference.naturalHeight
	);
	const width = reference.naturalWidth * scale;
	const height = reference.naturalHeight * scale;
	context.drawImage(
		reference,
		(canvas.width - width) / 2,
		(canvas.height - height) / 2,
		width,
		height
	);
	context.drawImage(overlayImage, 0, 0);
	return canvas.toDataURL("image/png");
}

type SketchDialogMessage =
	| { action: "close" }
	| {
			action: "attach";
			file: {
				dataUrl: string;
				filename: string;
				mimeType: "image/png";
				size: number;
			};
	  };

function postDialogMessage(message: SketchDialogMessage): void {
	const token = window.ryu?.context?.token;
	if (!token || window.parent === window) {
		return;
	}
	window.parent.postMessage(
		{ kind: "ryu-drawesome-dialog", token, ...message },
		"*"
	);
}

export default function App() {
	const isSketchDialog = window.ryu?.context?.mode === "sketch-dialog";
	const referenceImage = window.ryu?.context?.image;
	const drawing = useDrawing();
	const drawingAreaRef = useRef<HTMLDivElement>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hydratedRef = useRef(false);
	const scheduledStrokesRef = useRef<Stroke[] | null>(null);
	const titleRef = useRef(DEFAULT_SKETCH_TITLE);
	const strokesRef = useRef<Stroke[]>([]);

	const [mode, setMode] = useState<DrawesomeMode>(() =>
		window.ryu ? "live" : "demo"
	);
	const [loaded, setLoaded] = useState(false);
	const [title, setTitle] = useState(DEFAULT_SKETCH_TITLE);
	const [board, setBoard] = useState<Board>({ w: 1, h: 1 });
	const [activeTool, setActiveTool] = useState<SketchTool>("pen");
	const [color, setColor] = useState(DEFAULT_INK);
	const [brushSize, setBrushSize] = useState(6);
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const [exporting, setExporting] = useState<ExportFormat | null>(null);
	const [notice, setNotice] = useState("Your sketch is ready");

	strokesRef.current = drawing.strokes;
	titleRef.current = title;
	const surfaceTool: Tool = createDrawingTool(activeTool, color, brushSize);
	const drawingSurface = (
		<div
			className="drawesome-paper"
			data-testid="drawesome-paper"
			ref={drawingAreaRef}
		>
			{referenceImage ? (
				<img
					alt={referenceImage.filename}
					className="drawesome-dialog-reference"
					src={safeMediaUrl(referenceImage.url) ?? undefined}
				/>
			) : null}
			<DrawSurface
				background="transparent"
				board={board}
				className="drawesome-drawing-surface h-full w-full"
				drawing={drawing}
				tool={surfaceTool}
			/>
		</div>
	);

	useEffect(() => {
		let cancelled = false;
		loadSnapshot()
			.then(({ mode: nextMode, snapshot }) => {
				if (cancelled) {
					return;
				}
				setMode(nextMode);
				setTitle(snapshot.title);
				titleRef.current = snapshot.title;
				const nextStrokes = isSketchDialog ? [] : snapshot.strokes;
				drawing.reset(nextStrokes);
				scheduledStrokesRef.current = nextStrokes;
				strokesRef.current = nextStrokes;
				hydratedRef.current = true;
				setLoaded(true);
			})
			.catch(() => {
				if (!cancelled) {
					setLoaded(true);
					setSaveState("error");
					setNotice("The sketch opened, but storage is unavailable");
				}
			});
		return () => {
			cancelled = true;
		};
	}, [drawing.reset, isSketchDialog]);

	const persist = useCallback(
		async (nextTitle: string, nextStrokes: Stroke[]) => {
			setSaveState("saving");
			try {
				await saveSnapshot({ title: nextTitle, strokes: nextStrokes });
				setSaveState("saved");
				setNotice(
					mode === "live" ? "Saved to this Ryu node" : "Saved in this browser"
				);
			} catch {
				setSaveState("error");
				setNotice("This sketch is safe in memory, but could not be saved");
			}
		},
		[mode]
	);

	const scheduleSave = useCallback(
		(nextTitle = titleRef.current, nextStrokes = strokesRef.current) => {
			if (!hydratedRef.current) {
				return;
			}
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
			setSaveState("saving");
			timerRef.current = setTimeout(() => {
				persist(nextTitle, nextStrokes).catch(() => undefined);
			}, 650);
		},
		[persist]
	);

	useEffect(() => {
		if (scheduledStrokesRef.current === drawing.strokes) {
			return;
		}
		scheduledStrokesRef.current = drawing.strokes;
		strokesRef.current = drawing.strokes;
		if (hydratedRef.current && !isSketchDialog) {
			scheduleSave(titleRef.current, drawing.strokes);
		}
	}, [drawing.strokes, isSketchDialog, scheduleSave]);

	useEffect(
		() => () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
			if (hydratedRef.current && !isSketchDialog) {
				persist(titleRef.current, strokesRef.current).catch(() => undefined);
			}
		},
		[isSketchDialog, persist]
	);

	const handleTitleChange = useCallback(
		(next: string) => {
			setTitle(next);
			titleRef.current = next;
			scheduleSave(next, strokesRef.current);
		},
		[scheduleSave]
	);

	const handleExport = useCallback(
		async (format: ExportFormat) => {
			setExporting(format);
			try {
				const fileName = `${safeFileName(normalizeTitle(titleRef.current))}.${format}`;
				const blob =
					format === "png"
						? await toPng(strokesRef.current, board.w, board.h, null, 2)
						: new Blob([toSvg(strokesRef.current, board.w, board.h, null)], {
								type: "image/svg+xml",
							});
				downloadBlob(blob, fileName);
				setNotice(`Exported ${format.toUpperCase()} copy`);
				await notify(`Exported ${format.toUpperCase()} copy`, "success");
			} catch {
				setNotice(`Could not export ${format.toUpperCase()}`);
				await notify(`Could not export ${format.toUpperCase()}`, "error");
			} finally {
				setExporting(null);
			}
		},
		[board]
	);

	const handleAttachSketch = useCallback(async () => {
		if (!isSketchDialog || strokesRef.current.length === 0) {
			return;
		}
		setExporting("png");
		try {
			const blob = await toPng(strokesRef.current, board.w, board.h, null, 2);
			const dataUrl = referenceImage
				? await compositeReferenceImage(blob, referenceImage.url)
				: await blobToDataUrl(blob);
			postDialogMessage({
				action: "attach",
				file: {
					dataUrl,
					filename: referenceImage
						? `annotated-${safeFileName(referenceImage.filename)}.png`
						: "sketch.png",
					mimeType: "image/png",
					size: blob.size,
				},
			});
		} catch {
			setNotice("Could not prepare the sketch attachment");
		} finally {
			setExporting(null);
		}
	}, [board, isSketchDialog, referenceImage]);

	const handleCloseSketchDialog = useCallback(() => {
		postDialogMessage({ action: "close" });
	}, []);

	const handleNewSketch = useCallback(() => {
		const next = emptySnapshot();
		drawing.reset(next.strokes);
		setTitle(next.title);
		titleRef.current = next.title;
		scheduledStrokesRef.current = next.strokes;
		strokesRef.current = next.strokes;
		setNotice("New sketch started");
		scheduleSave(next.title, next.strokes);
	}, [drawing.reset, scheduleSave]);

	useEffect(() => {
		if (!loaded) {
			return;
		}
		const surface = drawingAreaRef.current;
		if (!surface) {
			return;
		}

		const measure = () => {
			const { height, width } = surface.getBoundingClientRect();
			const nextBoard = {
				h: Math.max(1, Math.round(height)),
				w: Math.max(1, Math.round(width)),
			};
			setBoard((previous) =>
				previous.w === nextBoard.w && previous.h === nextBoard.h
					? previous
					: nextBoard
			);
		};
		measure();
		if (globalThis.ResizeObserver === undefined) {
			window.addEventListener("resize", measure);
			return () => window.removeEventListener("resize", measure);
		}

		const observer = new ResizeObserver(measure);
		observer.observe(surface);
		return () => observer.disconnect();
	}, [loaded]);

	useEffect(() => {
		if (!loaded) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					target.closest("input, textarea, select, [contenteditable='true']"))
			) {
				return;
			}

			const key = event.key.toLowerCase();
			if ((event.metaKey || event.ctrlKey) && key === "z") {
				event.preventDefault();
				if (event.shiftKey) {
					drawing.redo();
				} else {
					drawing.undo();
				}
				return;
			}
			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			if (key === "p") {
				setActiveTool("pen");
			} else if (key === "h") {
				setActiveTool("highlighter");
			} else if (key === "e") {
				setActiveTool("eraser");
			} else if (key === "[") {
				setBrushSize((size) => Math.max(1, size - 1));
			} else if (key === "]") {
				setBrushSize((size) => Math.min(32, size + 1));
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [drawing.redo, drawing.undo, loaded]);

	if (!loaded) {
		return (
			<div className="drawesome-loading" role="status">
				<div className="drawesome-loading-mark" />
				<span>Preparing your paper…</span>
			</div>
		);
	}

	if (isSketchDialog) {
		return (
			<div
				className="drawesome-dialog-app"
				data-testid="drawesome-sketch-dialog"
			>
				<main className="drawesome-dialog-workspace">{drawingSurface}</main>
				<SketchToolDock
					activeTool={activeTool}
					drawing={drawing}
					onToolChange={setActiveTool}
					showHistory={false}
				/>
				<SketchHistoryControls drawing={drawing} floating />
				<BrushSizeControl onSizeChange={setBrushSize} size={brushSize} />
				<SketchPalette color={color} onColorChange={setColor} />

				<Button
					aria-label="Close sketch"
					className="absolute start-1 top-2 z-5"
					onClick={handleCloseSketchDialog}
					size="icon-sm"
					title="Close sketch"
					variant="ghost"
				>
					<SketchIcon name="close" />
				</Button>
				<Button
					aria-label="Attach sketch"
					className="absolute end-2 bottom-3 z-5"
					data-testid="drawesome-attach"
					disabled={drawing.strokes.length === 0 || exporting !== null}
					onClick={() => void handleAttachSketch()}
					size="icon-sm"
					title={exporting === "png" ? "Preparing sketch" : "Attach sketch"}
					variant="default"
				>
					<SketchIcon name="attach" />
				</Button>
				<p aria-live="polite" className="sr-only" role="status">
					{notice}
				</p>
			</div>
		);
	}

	return (
		<div className="drawesome-app" data-testid="drawesome-app">
			<main className="drawesome-workspace">{drawingSurface}</main>
			<SketchToolDock
				activeTool={activeTool}
				drawing={drawing}
				onToolChange={setActiveTool}
			/>
			<BrushSizeControl onSizeChange={setBrushSize} size={brushSize} />
			<SketchPalette color={color} onColorChange={setColor} />

			<div className="drawesome-topbar">
				<div className="drawesome-title-wrap">
					<Input
						aria-label="Sketch title"
						id="drawesome-title"
						onChange={(event) => handleTitleChange(event.target.value)}
						placeholder="Untitled sketch"
						value={title}
					/>
					<span
						aria-label={`Sketch ${SAVE_LABEL[saveState].toLowerCase()}`}
						className={`drawesome-save drawesome-save-${saveState}`}
						data-testid="drawesome-save-state"
						role="status"
						title={`${SAVE_LABEL[saveState]} · ${mode === "live" ? "Ryu storage" : "Browser preview"}`}
					>
						<span aria-hidden="true" className="drawesome-save-dot" />
						<span className="sr-only">
							{SAVE_LABEL[saveState]} in{" "}
							{mode === "live" ? "Ryu storage" : "browser preview"}
						</span>
					</span>
				</div>
				<div aria-label="Sketch actions" className="drawesome-actions">
					<Button
						aria-label="Start a new sketch"
						data-toolbar-new-sketch
						onClick={handleNewSketch}
						size="icon-sm"
						title="New sketch"
						variant="ghost"
					>
						<SketchIcon name="new" />
					</Button>
					<Button
						aria-label="Export sketch as SVG"
						disabled={exporting !== null}
						onClick={() => handleExport("svg")}
						size="icon-sm"
						title={exporting === "svg" ? "Exporting SVG" : "Export SVG"}
						variant="ghost"
					>
						<SketchIcon name="svg" />
					</Button>
					<Button
						aria-label="Export sketch as PNG"
						disabled={exporting !== null}
						onClick={() => handleExport("png")}
						size="icon-sm"
						title={exporting === "png" ? "Exporting PNG" : "Export PNG"}
						variant="ghost"
					>
						<SketchIcon name="image" />
					</Button>
				</div>
			</div>
			<p aria-live="polite" className="sr-only" role="status">
				{notice}
			</p>
		</div>
	);
}
