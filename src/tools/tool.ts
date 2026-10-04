import type { z } from "zod";

export type Tool<TSchema extends z.ZodType> = {
  name: string;
  description: string;
  inputSchema: TSchema;
  execute(args: z.infer<TSchema>): Promise<string>;
};
