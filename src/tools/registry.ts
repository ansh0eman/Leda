import { readFileTool } from "./read-file.js";
import { listFilesTool } from "./list-files.js";

export const ToolsRegistry = {
  read_file: readFileTool,
  list_files: listFilesTool,
};

export type ToolName = keyof typeof ToolsRegistry;
