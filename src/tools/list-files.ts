import { readdir } from "node:fs/promises";
import { z } from "zod";
import { getSafeProjectPath, isSensitiveFileName } from "./file-safety.js";
import type { Tool } from "./tool.js";

const listFilesInputSchema = z.object({
  directoryPath: z.string(),
});

export const listFilesTool: Tool<typeof listFilesInputSchema> = {
  name: "list_files",
  description: "Lists non-sensitive files and folders directly inside a project directory.",
  inputSchema: listFilesInputSchema,

  async execute(args): Promise<string> {
    try {
      const safePath = getSafeProjectPath(args.directoryPath);

      if (!safePath) {
        throw new Error("This directory cannot be listed.");
      }

      const entries = await readdir(safePath, { withFileTypes: true });

      return entries
        .filter((entry) => !isSensitiveFileName(entry.name))
        .map((entry) => {
          const type = entry.isDirectory() ? "[folder]" : "[file]";
          return `${type} ${entry.name}`;
        })
        .join("\n");
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to list directory at ${args.directoryPath}: ${error.message}`,
        );
      }

      throw new Error(
        `Failed to list directory at ${args.directoryPath}: Unknown error`,
      );
    }
  },
};
