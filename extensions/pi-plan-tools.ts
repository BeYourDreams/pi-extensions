import { pi } from "@earendil-works/pi-coding-agent";

const PLAN_HELPERS = ["plan_mode_question", "plan_mode_complete"];

export default function (pi: typeof import("@earendil-works/pi-coding-agent")) {
  pi.on("session_start", async (_event, ctx) => {
    // Re-activate plan-mode helpers after lazy-tools strips them
    const active = pi.getActiveTools();
    const missing = PLAN_HELPERS.filter((name) => !active.includes(name));
    if (missing.length > 0) {
      const allTools = pi.getAllTools().map((t) => t.name);
      const toAdd = missing.filter((name) => allTools.includes(name));
      if (toAdd.length > 0) {
        pi.setActiveTools([...active, ...toAdd]);
        ctx.ui?.notify?.(`Plan helpers re-activated: ${toAdd.join(", ")}`, "info");
      }
    }
  });
}
