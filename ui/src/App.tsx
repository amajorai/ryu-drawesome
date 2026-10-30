import type { Board, Stroke, Tool } from "drawesome";
import { DrawSurface, toPng, toSvg, useDrawing } from "drawesome";
import "drawesome/styles.css";
import { useLiteralMessages } from "@ryu/i18n/react";
import { Button } from "@ryu/ui/components/button.tsx";
import { Input } from "@ryu/ui/components/input.tsx";
import { safeMediaUrl } from "@ryu/ui/lib/safe-media-url.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	BrushSizeControl,
	SketchHistoryControls,
	SketchIcon,
	SketchPalette,
	SketchToolDock,
} from "./App-controls.tsx";
import {
	blobToDataUrl,
	compositeReferenceImage,
	downloadBlob,
	postDialogMessage,
	safeFileName,
} from "./App-export.ts";
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

const SAVE_LABEL = {
	idle: "Ready",
	saving: "Saving…",
	saved: "Saved",
	error: "Local copy only",
} satisfies Record<SaveState, string>;

const DEFAULT_INK = "#f5f5f5";

export default function App() {
	const isSketchDialog = window.ryu?.context?.mode === "sketch-dialog";
	const referenceImage = window.ryu?.context?.image;
	const drawing = useDrawing();
	const tl = useLiteralMessages();
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
				const exportedMessage = tl("Exported {format} copy", {
					format: format.toUpperCase(),
				});
				setNotice(exportedMessage);
				await notify(exportedMessage, "success");
			} catch {
				const failedMessage = tl("Could not export {format}", {
					format: format.toUpperCase(),
				});
				setNotice(failedMessage);
				await notify(failedMessage, "error");
			} finally {
				setExporting(null);
			}
		},
		[board, tl]
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
						aria-label={tl("Sketch {status}", {
							status: SAVE_LABEL[saveState].toLowerCase(),
						})}
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
