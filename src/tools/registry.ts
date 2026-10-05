import { readFileTool } from "./read-file.js";
import { listFilesTool } from "./list-files.js";
import { searchFilesTool } from "./search-files.js";

export const ToolsRegistry = {
  read_file: readFileTool,
  list_files: listFilesTool,
  search_files: searchFilesTool,
};

export type ToolName = keyof typeof ToolsRegistry;
