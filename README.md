# Leda

Leda is an early-stage, terminal-native agentic coding assistant written in TypeScript. It uses LLM-selected, read-only tools to inspect a local project and answer questions about it.

## What it currently does

- Accepts a natural-language prompt through `npm run ask`.
- Exposes registered tools to the OpenAI model using JSON Schema generated from Zod schemas.
- Validates tool arguments at runtime in a central runner, then executes the selected tool.
- Repeats the LLM → tool → observation cycle until the model answers or a limit is reached.
- Provides filesystem tools (`read_file`, `list_files`, `search_files`) and read-only Git tools (`git_status`, `git_diff`, `git_log`, `git_branch`).
- Allows at most 10 model turns and 6 tool calls per request. Tool calls are sequential.

## How it works

```text
CLI prompt
    ↓
Agent orchestrator (history and limits)
    ↓
Model adapter → OpenAI
    ↓
Tool call?
    ├─ no → final answer
    └─ yes
         ↓
    tool registry
         ↓
    Zod validation
         ↓
    file safety checks
         ↓
    execute tool
         ↓
    tool result → back to LLM
```

`src/cli.ts` reads the prompt and configuration, creates the OpenAI adapter and tool executor, and prints progress. `src/agent/orchestrator.ts` owns the conversation history, tool execution, counters, and final state. `src/model/model.ts` defines provider-neutral messages, tool calls, and the `ModelAdapter` interface; `src/model/openai-adapter.ts` maps those to and from the OpenAI SDK. The registry supplies tool definitions, while `callTool` validates arguments with Zod and returns a typed outcome.

The orchestrator runs requested tools sequentially and appends a result for every requested call ID. Malformed JSON, unknown tools, validation failures, and execution failures become distinct tool observations. It returns `completed`, `stopped`, or `error`; a limit stop is never reported as an answer. Requested calls beyond the six-call limit are paired with a “not executed” result. API errors retain HTTP status, code, and type when available.

## Current tools

| Tool | Status | Purpose |
| --- | --- | --- |
| `read_file` | Implemented | Reads a project text file after basic path and filename checks. |
| `list_files` | Implemented | Lists direct entries in a project directory, filtering selected sensitive names. |
| `search_files` | Implemented | Recursively searches project text files and returns up to 50 matching lines. |
| `git_status` | Implemented | Reports the current branch plus staged, unstaged, and untracked changes. |
| `git_diff` | Implemented | Shows staged or unstaged changes, optionally for one file. |
| `git_log` | Implemented | Shows up to 20 recent commits. |
| `git_branch` | Implemented | Reports the current and local branches. |

For example, ask “What files have changed?”, “Show the staged diff for `src/cli.ts`,” or “Summarize the last five commits.” Git inspection runs only against the current working directory; it does not modify the repository.

## Roadmap

Checked items exist in the current codebase; unchecked items are plans, not available commands.

### Filesystem

- [x] `read_file`
- [x] `list_files`
- [x] `search_files`
- [ ] `file_exists`
- [ ] `write_file`
- [ ] `move_file`
- [ ] `delete_file`

### Git

- [x] `git_status`
- [x] `git_diff`
- [x] `git_log`
- [x] `git_branch`

### Terminal

- [ ] `run_command`
- [ ] `run_tests`
- [ ] `run_build`
- [ ] `run_linter`

### Agent capabilities

- [x] Iterative tool-use loop
- [x] Runtime argument validation
- [x] Tool registry
- [x] Basic file safety checks
- [x] Model-turn and tool-call limits
- [ ] Human approval for write actions
- [ ] Explicit planning
- [ ] Self-correction after test failures
- [ ] Persistent task state
- [ ] Sandboxed execution
- [ ] GitHub issue → PR workflow
- [ ] Tracing and evaluations

## Tech stack

- TypeScript and Node.js
- OpenAI SDK and function/tool calling
- Zod for runtime validation and JSON Schema generation

## Running locally

```sh
npm install
```

Create a local `.env` file containing your OpenAI API key:

```dotenv
OPENAI_API_KEY=your_key_here
# Optional; defaults to gpt-6-luna
OPENAI_MODEL=gpt-6-luna
```

Run the CLI:

```sh
npm run ask -- "What does package.json contain?"
```

Check, test, and build:

```sh
npm run typecheck
npm test
npm run build
```

`npm run dev -- "Your question"` uses the same CLI entrypoint as `ask`. The build emits JavaScript in `dist/`. Do not commit `.env` or `dist/`. Tests use a fake model and make no API calls.

## Safety

See [SECURITY.md](SECURITY.md) for responsible vulnerability reporting, prompt-injection risks, and trust boundaries.


File tools reject requested paths outside the project and block selected credential-like filenames, including `.env` variants and common key files. Tool inputs are validated with Zod. Leda currently has no write or shell tools.

These checks are an early boundary, not a sandbox or comprehensive secret scanner. In particular, symlink targets are not resolved before reading. Review a project before allowing its file contents to be sent to the model.

## Project status

Leda is an early-stage learning and engineering project. The goal is to progressively build toward a more capable coding agent while keeping implemented features and planned work clearly separated.
