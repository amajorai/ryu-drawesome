import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import ts from "typescript";

const uiRoot = resolve(import.meta.dirname, "..");
const mapPath = resolve(import.meta.dirname, "companion-interactions.json");
const specPath = resolve(
	import.meta.dirname,
	"drawesome-sketch-workflow.spec.ts"
);
const eventAttributes = new Set(["onChange", "onClick", "onDrop"]);

function componentName(node) {
	for (let current = node.parent; current; current = current.parent) {
		if (ts.isFunctionDeclaration(current) && current.name) {
			return current.name.text;
		}
		if (
			ts.isVariableDeclaration(current) &&
			ts.isIdentifier(current.name) &&
			current.initializer &&
			(ts.isArrowFunction(current.initializer) ||
				ts.isFunctionExpression(current.initializer))
		) {
			return current.name.text;
		}
	}
	return "module";
}

// A source file split by responsibility keeps its controls in `<Stem>-*.tsx`
// siblings, so the census covers the original file plus those siblings.
function withSplitSiblings(sourceFilePath) {
	const directory = dirname(sourceFilePath);
	const stem = basename(sourceFilePath, ".tsx");
	const siblings = readdirSync(resolve(uiRoot, directory))
		.filter(
			(name) =>
				name.startsWith(`${stem}-`) &&
				name.endsWith(".tsx") &&
				!name.includes(".test.")
		)
		.sort()
		.map((name) => `${directory}/${name}`);
	return [sourceFilePath, ...siblings];
}

function scanSourceRows(sourceFilePath) {
	const sourcePath = resolve(uiRoot, sourceFilePath);
	const source = readFileSync(sourcePath, "utf8");
	const sourceFile = ts.createSourceFile(
		sourcePath,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX
	);
	const rows = [];
	const visit = (node) => {
		if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
			const sourceTag = node.tagName.getText(sourceFile);
			const tag = sourceTag.includes(".")
				? (sourceTag.split(".").at(-1) ?? sourceTag)
				: sourceTag;
			const events = node.attributes.properties
				.filter(
					(attribute) =>
						ts.isJsxAttribute(attribute) &&
						eventAttributes.has(attribute.name.getText())
				)
				.map((attribute) => attribute.name.getText());
			if (events.length > 0) {
				const label = node.attributes.properties.find(
					(attribute) =>
						ts.isJsxAttribute(attribute) &&
						attribute.name.getText() === "aria-label"
				);
				const position = sourceFile.getLineAndCharacterOfPosition(
					node.getStart(sourceFile)
				);
				rows.push({
					package: "drawesome",
					source_file: `apps-store/drawesome/ui/${sourceFilePath}`,
					line: String(position.line + 1),
					component: componentName(node),
					tag,
					events: events.join(","),
					label:
						label?.initializer && ts.isStringLiteral(label.initializer)
							? label.initializer.text
							: "",
				});
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return rows;
}

function scanCurrentDrawesomeRows() {
	return withSplitSiblings("src/App.tsx").flatMap(scanSourceRows);
}

function identity(row) {
	return [
		row.package,
		row.source_file,
		row.line,
		row.component,
		row.tag,
		row.events,
	].join(":");
}

function namedTestBody(source, title) {
	const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = new RegExp(
		`(?:^|\\n)\\s*test\\(\\s*["']${escapedTitle}["']`,
		"m"
	).exec(source);
	if (!match) {
		return "";
	}
	const nextTestOffset = source
		.slice(match.index + match[0].length)
		.search(/\n\s*test\s*\(/);
	const end =
		nextTestOffset === -1
			? source.length
			: match.index + match[0].length + nextTestOffset;
	return source.slice(match.index, end);
}

describe("Drawesome package-owned interaction map", () => {
	test("reconciles the current Close, Attach, and PNG export controls to named rendered assertions", () => {
		const map = JSON.parse(readFileSync(mapPath, "utf8"));
		const specSource = readFileSync(specPath, "utf8");
		const packageManifest = JSON.parse(
			readFileSync(resolve(uiRoot, "package.json"), "utf8")
		);
		const liveRows = scanCurrentDrawesomeRows();
		const liveIdentities = new Set(liveRows.map(identity));
		const mappedIdentities = map.assertions.map(({ row }) => identity(row));

		expect(map.scope).toBe("partial");
		expect(map.version).toBe(1);
		expect(map.expectedRows).toBe(3);
		expect(map.assertions).toHaveLength(3);
		expect([...mappedIdentities].sort()).toEqual(
			[
				"drawesome:apps-store/drawesome/ui/src/App.tsx:367:App:Button:onClick",
				"drawesome:apps-store/drawesome/ui/src/App.tsx:377:App:Button:onClick",
				"drawesome:apps-store/drawesome/ui/src/App.tsx:453:App:Button:onClick",
			].sort()
		);
		for (const mappedIdentity of mappedIdentities) {
			expect(liveIdentities.has(mappedIdentity)).toBe(true);
		}
		expect(
			liveRows
				.filter((row) => mappedIdentities.includes(identity(row)))
				.map((row) => row.label)
				.sort()
		).toEqual(["Attach sketch", "Close sketch", "Export sketch as PNG"]);
		expect(packageManifest.ryuCompanionInteractionMap).toBe(
			"e2e/companion-interactions.json"
		);
		expect(map.selector).toEqual({
			spec: "e2e/drawesome-sketch-workflow.spec.ts",
			config: "playwright.config.ts",
		});
		expect(existsSync(resolve(uiRoot, map.selector.spec))).toBe(true);
		expect(existsSync(resolve(uiRoot, map.selector.config))).toBe(true);
		for (const assertion of map.assertions) {
			const body = namedTestBody(specSource, assertion.testTitle);
			expect(body).toContain(assertion.assertionMarker);
			expect(body).toMatch(/\bexpect\s*\(/u);
		}
	});
});
