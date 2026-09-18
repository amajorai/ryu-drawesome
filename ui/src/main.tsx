import {
	markCompanionAppRoot,
	subscribeCompanionTheme,
} from "@ryu/app-host/companion-theme";
import { RyuAppShell } from "@ryu/blocks/companion/app-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

subscribeCompanionTheme();
const root = document.getElementById("ryu-plugin-root");
if (!root) {
	throw new Error("Drawesome root element is missing.");
}

markCompanionAppRoot(root, { surface: "editor" });

createRoot(root).render(
	<StrictMode>
		<RyuAppShell surface="editor">
			<App />
		</RyuAppShell>
	</StrictMode>
);
