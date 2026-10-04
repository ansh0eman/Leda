import { readFile as readFileFromDisk } from "node:fs/promises";
import { z } from "zod";
import { getSafeProjectPath } from "./file-safety.js";
import type { Tool } from "./tool.js";

const readFileInputSchema = z.object({
  filePath: z.string(),
});

export const readFileTool: Tool<typeof readFileInputSchema> = {
  name: "read_file",
  description: "Reads a text file inside this project and returns its contents.",
  inputSchema: readFileInputSchema,

  async execute(args): Promise<string> {
    try {
      const safePath = getSafeProjectPath(args.filePath);

      if (!safePath) {
        throw new Error("This file cannot be read.");
      }

      return await readFileFromDisk(safePath, "utf8");
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to read file at ${args.filePath}: ${error.message}`);
      }

      throw new Error(`Failed to read file at ${args.filePath}: Unknown error`);
    }
  },
};
