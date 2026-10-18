import { readFileTool } from "./read-file.js";
import { listFilesTool } from "./list-files.js";
import { searchFilesTool } from "./search-files.js";
import { gitStatusTool } from "./git-status.js";
import { gitDiffTool } from "./git-diff.js";
import { gitLogTool } from "./git-log.js";
import { gitBranchTool } from "./git-branch.js";
import { editFileTool } from "./edit-file.js";

export const ToolsRegistry = {
  read_file: readFileTool,
  list_files: listFilesTool,
  search_files: searchFilesTool,
  git_status: gitStatusTool,
  git_diff: gitDiffTool,
  git_log: gitLogTool,
  git_branch: gitBranchTool,
  edit_file: editFileTool,
};

export type ToolName = keyof typeof ToolsRegistry;
