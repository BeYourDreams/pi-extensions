/**
 * codemode-only — block direct tool calls when codemode.mode is "only"
 *
 * mode:"only" hides declarations but tools stay active, so a confused model
 * can still call bash/read/edit/write directly (and it executes). This
 * intercepts direct (non-nested) calls and tells the model to use codemode;
 * nested calls (parentToolCallId set) from codemode scripts pass through.
 * 0 prompt overhead.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const ORCHESTRATORS = new Set(["codemode", "omnify"]);

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		// Nested calls come from codemode/scripts via executeTool — allow.
		if ((event as { parentToolCallId?: string }).parentToolCallId) return;
		// Direct calls to orchestrators are fine.
		if (ORCHESTRATORS.has(event.toolName)) return;
		// Block direct calls to everything else; model must go through codemode.
		return {
			block: true,
			reason:
				`Direct \`${event.toolName}\` calls are disabled in codemode-only mode. Use \`codemode\` (e.g. await tools.${event.toolName.replace(/[^a-zA-Z0-9_$]/g, "_")}({...})) or \`omnify\`.`,
		};
	});
}
