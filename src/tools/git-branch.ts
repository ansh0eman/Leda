import { z } from "zod";
import { runGit } from "./git-command.js";
import type { Tool } from "./tool.js";

const inputSchema = z.object({});

export const gitBranchTool: Tool<typeof inputSchema> = {
  name: "git_branch",
  description: "Reports the current branch and available local branches.",
  inputSchema,

  async execute(): Promise<string> {
    const output = await runGit(["branch", "--list", "--no-color"]);
    const branches = output ? output.split("\n") : [];
    const current = branches.find((branch) => branch.startsWith("* "))?.slice(2) ?? "(detached HEAD)";
    const names = branches.map((branch) => branch.replace(/^\*?\s+/, ""));
    return [
      `Current branch: ${current}`,
      "Local branches:",
      names.length ? names.map((name) => `  ${name}`).join("\n") : "  none",
    ].join("\n");
  },
};
