import type { z } from "zod";

export type EditProposal = {
  filePath: string;
  oldText: string;
  newText: string;
};

export type ToolExecutionContext = {
  approveEdit?: (proposal: EditProposal) => Promise<boolean>;
};

export type Tool<TSchema extends z.ZodType> = {
  name: string;
  description: string;
  inputSchema: TSchema;
  execute(args: z.infer<TSchema>, context?: ToolExecutionContext): Promise<string>;
};
