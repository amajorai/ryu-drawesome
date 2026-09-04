import type { DrawesomeSnapshot } from "./model";
import {
	DRAWESOME_STORAGE_KEY,
	DRAWESOME_STORAGE_NAMESPACE,
	emptySnapshot,
	parseSnapshot,
	serializeSnapshot,
} from "./model";

export type DrawesomeMode = "demo" | "live";

function localStorageGet(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function localStorageSet(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// A null-origin preview may not expose localStorage. The canvas still works.
	}
}

function liveStorage(): NonNullable<Window["ryu"]>["storage"] | null {
	const storage = window.ryu?.storage;
	return storage?.set ? storage : null;
}

export async function loadSnapshot(): Promise<{
	mode: DrawesomeMode;
	snapshot: DrawesomeSnapshot;
}> {
	const storage = liveStorage();
	if (storage) {
		try {
			const value = await storage.get({
				key: DRAWESOME_STORAGE_KEY,
				namespace: DRAWESOME_STORAGE_NAMESPACE,
			});
			return {
				mode: "live",
				snapshot: value ? parseSnapshot(JSON.parse(value)) : emptySnapshot(),
			};
		} catch {
			// A live storage failure must not silently switch to browser-local data.
			return { mode: "live", snapshot: emptySnapshot() };
		}
	}

	const value = localStorageGet(
		`${DRAWESOME_STORAGE_NAMESPACE}:${DRAWESOME_STORAGE_KEY}`
	);
	if (!value) {
		return { mode: "demo", snapshot: emptySnapshot() };
	}
	try {
		return { mode: "demo", snapshot: parseSnapshot(JSON.parse(value)) };
	} catch {
		return { mode: "demo", snapshot: emptySnapshot() };
	}
}

export async function saveSnapshot(snapshot: DrawesomeSnapshot): Promise<void> {
	const value = serializeSnapshot(snapshot);
	const storage = liveStorage();
	if (storage) {
		await storage.set({
			key: DRAWESOME_STORAGE_KEY,
			namespace: DRAWESOME_STORAGE_NAMESPACE,
			value,
		});
		return;
	}
	localStorageSet(
		`${DRAWESOME_STORAGE_NAMESPACE}:${DRAWESOME_STORAGE_KEY}`,
		value
	);
}

export async function notify(
	message: string,
	kind: "info" | "success" | "error" = "info"
) {
	try {
		await window.ryu?.ui?.toast?.show({ title: message, variant: kind });
	} catch {
		// Toasts are optional feedback; the inline status remains authoritative.
	}
}
