import type { ToastShowInput } from "@ryu/app-host/rpc";

declare global {
	interface Window {
		ryu?: {
			context?: {
				image?: {
					filename: string;
					url: string;
				};
				mode?: "sketch-dialog";
				token?: string;
			} | null;
			storage?: {
				get(input: { key: string; namespace?: string }): Promise<string | null>;
				set(input: {
					key: string;
					namespace?: string;
					value: string;
				}): Promise<void>;
			};
			ui?: {
				toast?: {
					show(input: ToastShowInput): Promise<string>;
				};
			};
		};
	}
}
