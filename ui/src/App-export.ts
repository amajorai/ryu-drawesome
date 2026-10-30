export function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}

export function safeFileName(title: string): string {
	const cleaned = title
		.trim()
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return cleaned || "untitled-sketch";
}

export function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () =>
			reject(reader.error ?? new Error("Could not read sketch"));
		reader.readAsDataURL(blob);
	});
}

export function loadImage(source: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("Could not load reference image"));
		image.src = source;
	});
}

export async function compositeReferenceImage(
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

export function postDialogMessage(message: SketchDialogMessage): void {
	const token = window.ryu?.context?.token;
	if (!token || window.parent === window) {
		return;
	}
	window.parent.postMessage(
		{ kind: "ryu-drawesome-dialog", token, ...message },
		"*"
	);
}
