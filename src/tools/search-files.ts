import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { z } from "zod";
import { getSafeProjectPath, isSensitiveFileName } from "./file-safety.js";
import type { Tool } from "./tool.js";

const ignoredDirectoryNames = [".git", "node_modules", "dist", "build"];
const MAX_RESULTS = 50;

const searchFilesInputSchema = z.object({
  directoryPath: z.string(),
  query: z.string(),
});

async function searchDirectory(
  directoryPath: string,
  query: string,
  results: string[],
): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) {
      return;
    }

    if (ignoredDirectoryNames.includes(entry.name) || isSensitiveFileName(entry.name)) {
      continue;
    }

    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      await searchDirectory(entryPath, query, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    try {
      const contents = await readFile(entryPath, "utf8");
      const lines = contents.split("\n");

      for (const [lineIndex, line] of lines.entries()) {
        if (!line.includes(query)) {
          continue;
        }

        const filePath = relative(process.cwd(), entryPath);
        results.push(`${filePath}:${lineIndex + 1}: ${line}`);

        if (results.length >= MAX_RESULTS) {
          return;
        }
      }
    } catch {
      // Skip files that cannot be read as UTF-8 text.
    }
  }
}

export const searchFilesTool: Tool<typeof searchFilesInputSchema> = {
  name: "search_files",
  description:
    "Recursively searches safe project text files for a query and returns matching paths, line numbers, and lines.",
  inputSchema: searchFilesInputSchema,

  async execute(args): Promise<string> {
    const safePath = getSafeProjectPath(args.directoryPath);

    if (!safePath) {
      throw new Error("This directory cannot be searched.");
    }

    const results: string[] = [];
    await searchDirectory(safePath, args.query, results);

    if (results.length === 0) {
      return `No matches found for "${args.query}".`;
    }

    return results.join("\n");
  },
};
