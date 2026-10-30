import { useLiteralMessages } from "@ryu/i18n/react";
import { Button } from "@ryu/ui/components/button.tsx";
import type { DrawingController } from "drawesome";
import type { ReactNode } from "react";
import type { SketchTool } from "./model.ts";

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

export function SketchIcon({ name }: { name: SketchIconName }) {
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

export function SketchHistoryControls({
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

export function SketchToolDock({
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

export function SketchPalette({
	color,
	onColorChange,
}: {
	color: string;
	onColorChange: (color: string) => void;
}) {
	const tl = useLiteralMessages();
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
					aria-label={tl("Ink {swatch}", { swatch })}
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

export function BrushSizeControl({
	size,
	onSizeChange,
}: {
	size: number;
	onSizeChange: (size: number) => void;
}) {
	const tl = useLiteralMessages();
	return (
		<label className="drawesome-size-control">
			<span className="sr-only">Brush size</span>
			<input
				aria-label="Brush size"
				max="32"
				min="1"
				onChange={(event) => onSizeChange(Number(event.target.value))}
				step="1"
				title={tl("Brush size {size}", { size: String(size) })}
				type="range"
				value={size}
			/>
		</label>
	);
}
