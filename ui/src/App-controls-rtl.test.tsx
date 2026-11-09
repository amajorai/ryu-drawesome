import { expect, test } from "bun:test";
import { DIRECTIONAL_ICON_CLASS } from "@ryu/ui/components/directional-icon.tsx";
import { renderToStaticMarkup } from "react-dom/server";
import { SketchIcon } from "./App-controls.tsx";

// Undo and redo curl along the reading direction. Under Arabic they kept
// their left-to-right curl, so Undo pointed toward the reading "forward".

function svgClass(name: Parameters<typeof SketchIcon>[0]["name"]): string {
	const markup = renderToStaticMarkup(<SketchIcon name={name} />);
	return /<svg[^>]*\sclass="([^"]*)"/.exec(markup)?.[1] ?? "";
}

test("the undo and redo glyphs mirror under RTL", () => {
	expect(svgClass("undo")).toContain(DIRECTIONAL_ICON_CLASS);
	expect(svgClass("redo")).toContain(DIRECTIONAL_ICON_CLASS);
});

test("non-directional sketch glyphs do not mirror", () => {
	for (const name of ["pen", "close", "attach", "new", "image"] as const) {
		expect(svgClass(name)).not.toContain(DIRECTIONAL_ICON_CLASS);
	}
});
