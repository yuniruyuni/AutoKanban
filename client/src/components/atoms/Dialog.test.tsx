import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "./Dialog";

describe("Dialog", () => {
	test("does not render anything when closed", () => {
		render(
			<Dialog open={false} onClose={() => {}}>
				<DialogHeader>Title</DialogHeader>
			</Dialog>,
		);
		expect(screen.queryByText("Title")).not.toBeInTheDocument();
	});

	test("renders header, content, and footer when open", () => {
		render(
			<Dialog open onClose={() => {}}>
				<DialogHeader>Header text</DialogHeader>
				<DialogContent>Body text</DialogContent>
				<DialogFooter>
					<button type="button">Action</button>
				</DialogFooter>
			</Dialog>,
		);
		expect(screen.getByText("Header text")).toBeInTheDocument();
		expect(screen.getByText("Body text")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
	});

	// Regression: on a vertically narrow viewport the Create PR (and other) dialog action
	// buttons used to be clipped because the dialog body was not scrollable. The fix
	// makes DialogContent the only scrollable region while Header and Footer stay pinned,
	// so action buttons remain reachable regardless of inner content height.
	describe("vertically narrow viewport (regression)", () => {
		test("DialogContent is scrollable and shrinkable inside the flex column", () => {
			render(
				<Dialog open onClose={() => {}}>
					<DialogContent>
						<div style={{ height: 5000 }}>tall</div>
					</DialogContent>
				</Dialog>,
			);
			const content = screen.getByText("tall").parentElement;
			expect(content).not.toBeNull();
			expect(content?.className).toMatch(/overflow-y-auto/);
			// min-h-0 lets the flex item shrink below its content size, which is what
			// actually engages the overflow-y-auto scroll when the dialog hits max-h-[90vh].
			expect(content?.className).toMatch(/min-h-0/);
		});

		test("DialogFooter does not shrink, so action buttons stay visible", () => {
			render(
				<Dialog open onClose={() => {}}>
					<DialogContent>
						<div style={{ height: 5000 }}>tall</div>
					</DialogContent>
					<DialogFooter>
						<button type="button">Create PR</button>
					</DialogFooter>
				</Dialog>,
			);
			const footer = screen.getByRole("button", {
				name: "Create PR",
			}).parentElement;
			expect(footer).not.toBeNull();
			expect(footer?.className).toMatch(/flex-shrink-0/);
		});

		test("DialogHeader does not shrink either", () => {
			render(
				<Dialog open onClose={() => {}}>
					<DialogHeader>Header</DialogHeader>
					<DialogContent>
						<div style={{ height: 5000 }}>tall</div>
					</DialogContent>
				</Dialog>,
			);
			// DialogHeader wraps its title in a column-flex div, then that lives inside the
			// outer header div which carries the layout classes.
			const header = screen
				.getByText("Header")
				.closest("div.flex.flex-shrink-0");
			expect(header).not.toBeNull();
		});

		test("DialogFooter is a sibling of DialogContent (outside the scroll container)", () => {
			render(
				<Dialog open onClose={() => {}}>
					<DialogContent>
						<div style={{ height: 5000 }}>tall</div>
					</DialogContent>
					<DialogFooter>
						<button type="button">Create PR</button>
					</DialogFooter>
				</Dialog>,
			);
			const content = screen.getByText("tall").parentElement;
			const footer = screen.getByRole("button", {
				name: "Create PR",
			}).parentElement;
			// Both must share the same parent (the dialog box) — if footer were nested
			// inside content, scrolling content would also scroll the buttons away.
			expect(content?.parentElement).toBe(footer?.parentElement);
		});
	});
});
