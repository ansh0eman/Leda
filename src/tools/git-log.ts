import { z } from "zod";
import { runGit } from "./git-command.js";
import type { Tool } from "./tool.js";

const inputSchema = z.object({ count: z.number().int().min(1).max(20).default(10) });

export const gitLogTool: Tool<typeof inputSchema> = {
  name: "git_log",
  description: "Shows a bounded list of the latest commits, up to 20.",
  inputSchema,

  async execute(args): Promise<string> {
    const output = await runGit([
      "log", "--no-color", "--oneline", "--decorate", `-n${args.count}`, "--",
    ]);
    return output || "No commits found.";
  },
};
