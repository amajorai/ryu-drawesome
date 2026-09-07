import type { DrawHandle, Stroke } from "drawesome";
import { Draw } from "drawesome";
import "drawesome/styles.css";
import { Button } from "@ryu/ui/components/button.tsx";
import { Input } from "@ryu/ui/components/input.tsx";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawesomeMode } from "./bridge";
import { loadSnapshot, notify, saveSnapshot } from "./bridge";
import { DEFAULT_SKETCH_TITLE, emptySnapshot, normalizeTitle } from "./model";
import "./drawesome.css";

type SaveState = "idle" | "saving" | "saved" | "error";
type ExportFormat = "png" | "svg";

const SAVE_LABEL: Record<SaveState, string> = {
	idle: "Ready",
	saving: "Saving…",
	saved: "Saved",
	error: "Local copy only",
};

function safeFileName(title: string): string {
	const cleaned = title
		.trim()
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return cleaned || "untitled-sketch";
}

export default function App() {
	const drawRef = useRef<DrawHandle>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hydratedRef = useRef(false);
	const titleRef = useRef(DEFAULT_SKETCH_TITLE);
	const strokesRef = useRef<Stroke[]>([]);

	const [mode, setMode] = useState<DrawesomeMode>("demo");
	const [loaded, setLoaded] = useState(false);
	const [title, setTitle] = useState(DEFAULT_SKETCH_TITLE);
	const [strokes, setStrokes] = useState<Stroke[]>([]);
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const [exporting, setExporting] = useState<ExportFormat | null>(null);
	const [notice, setNotice] = useState("Your sketch is ready");

	strokesRef.current = strokes;
	titleRef.current = title;

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
				setStrokes(snapshot.strokes);
				strokesRef.current = snapshot.strokes;
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
	}, []);

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

	useEffect(
		() => () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
			if (hydratedRef.current) {
				persist(titleRef.current, strokesRef.current).catch(() => undefined);
			}
		},
		[persist]
	);

	const handleChange = useCallback(
		(next: Stroke[]) => {
			setStrokes(next);
			strokesRef.current = next;
			scheduleSave(titleRef.current, next);
		},
		[scheduleSave]
	);

	const handleTitleChange = useCallback(
		(next: string) => {
			setTitle(next);
			titleRef.current = next;
			scheduleSave(next, strokesRef.current);
		},
		[scheduleSave]
	);

	const handleExport = useCallback(async (format: ExportFormat) => {
		if (!drawRef.current) {
			return;
		}
		setExporting(format);
		try {
			await drawRef.current.download(
				safeFileName(normalizeTitle(titleRef.current)),
				format,
				format === "png" ? 2 : 1
			);
			setNotice(`Exported ${format.toUpperCase()} copy`);
			await notify(`Exported ${format.toUpperCase()} copy`, "success");
		} catch {
			setNotice(`Could not export ${format.toUpperCase()}`);
			await notify(`Could not export ${format.toUpperCase()}`, "error");
		} finally {
			setExporting(null);
		}
	}, []);

	const handleNewSketch = useCallback(() => {
		const next = emptySnapshot();
		drawRef.current?.setStrokes(next.strokes);
		setTitle(next.title);
		titleRef.current = next.title;
		setStrokes(next.strokes);
		strokesRef.current = next.strokes;
		setNotice("New sketch started");
		scheduleSave(next.title, next.strokes);
	}, [scheduleSave]);

	if (!loaded) {
		return (
			<div className="drawesome-loading" role="status">
				<div className="drawesome-loading-mark" />
				<span>Preparing your paper…</span>
			</div>
		);
	}

	return (
		<div className="drawesome-app">
			<header className="drawesome-header">
				<div className="drawesome-brand">
					<div aria-hidden="true" className="drawesome-mark">
						<svg role="presentation" viewBox="0 0 32 32">
							<path d="m7 24 3-8L22 4l6 6-12 12-9 2Z" />
							<path d="m19 7 6 6M10 16l6 6" />
						</svg>
					</div>
					<div>
						<div className="drawesome-kicker">Ryu / creative tools</div>
						<h1>Drawesome</h1>
					</div>
				</div>
				<div className="drawesome-title-wrap">
					<Input
						aria-label="Sketch title"
						className="drawesome-title"
						id="drawesome-title"
						onChange={(event) => handleTitleChange(event.target.value)}
						placeholder="Untitled sketch"
						value={title}
					/>
					<span className="drawesome-save" data-testid="drawesome-save-state">
						<span
							className={`drawesome-save-dot drawesome-save-${saveState}`}
						/>
						{SAVE_LABEL[saveState]}
					</span>
				</div>
				<div className="drawesome-actions">
					<span className="drawesome-mode" data-testid="drawesome-mode">
						<span className="drawesome-mode-dot" />
						{mode === "live" ? "Ryu storage" : "Browser preview"}
					</span>
					<Button
						aria-label="Start a new sketch"
						className="drawesome-new"
						onClick={handleNewSketch}
						variant="ghost"
					>
						New sketch
					</Button>
					<Button
						aria-label="Export sketch as SVG"
						className="drawesome-export"
						disabled={exporting !== null}
						onClick={() => handleExport("svg")}
						variant="outline"
					>
						{exporting === "svg" ? "Exporting…" : "SVG"}
					</Button>
					<Button
						aria-label="Export sketch as PNG"
						className="drawesome-export drawesome-export-primary"
						disabled={exporting !== null}
						onClick={() => handleExport("png")}
						variant="default"
					>
						{exporting === "png" ? "Exporting…" : "PNG"}
					</Button>
				</div>
			</header>

			<main className="drawesome-workspace">
				<div className="drawesome-canvas-frame">
					<div className="drawesome-canvas-meta">
						<span>SKETCHBOOK 01</span>
						<span>
							{strokes.length === 0 ? "Blank page" : `${strokes.length} marks`}
						</span>
					</div>
					<div className="drawesome-paper" data-testid="drawesome-paper">
						<Draw
							background="transparent"
							depth="strong"
							drawWhenMinimized
							gauge
							initialStrokes={strokes}
							ink="auto"
							onChange={handleChange}
							ref={drawRef}
							startMinimized={false}
							style={{ height: "100%", width: "100%" }}
							theme="light"
						/>
					</div>
					<div aria-live="polite" className="drawesome-canvas-note">
						<span className="drawesome-note-pin" />
						{notice}
					</div>
				</div>
			</main>

			<footer className="drawesome-footer">
				<span>Hold Shift to draw straight lines</span>
				<span className="drawesome-footer-separator">·</span>
				<span>⌘ Z to undo</span>
				<span className="drawesome-footer-separator">·</span>
				<span>E for eraser</span>
			</footer>
		</div>
	);
}
