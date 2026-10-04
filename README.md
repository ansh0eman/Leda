# Leda

Leda is an early-stage, terminal-native agentic coding assistant written in TypeScript. It uses LLM-selected, read-only tools to inspect a local project and answer questions about it.

## What it currently does

- Accepts a natural-language prompt through `npm run ask`.
- Exposes registered tools to the OpenAI model using JSON Schema generated from Zod schemas.
- Validates tool arguments at runtime in a central runner, then executes the selected tool.
- Repeats the LLM → tool → observation cycle until the model answers or a limit is reached.
- Provides `read_file` and `list_files`, with basic path and filename restrictions.
- Allows at most 10 model turns and 6 tool calls per request. Tool calls are sequential.

## How it works

```text
User prompt
    ↓
Agent loop
    ↓
LLM
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

The registry supplies the tool name, description, and input schema to the model. The model requests a tool; local TypeScript code validates its arguments, runs it, and returns its result as a tool message. The loop keeps the conversation history so the model can use each observation in its next decision.

## Current tools

| Tool | Status | Purpose |
| --- | --- | --- |
| `read_file` | Implemented | Reads a project text file after basic path and filename checks. |
| `list_files` | Implemented | Lists direct entries in a project directory, filtering selected sensitive names. |

## Roadmap

Checked items exist in the current codebase; unchecked items are plans, not available commands.

### Filesystem

- [x] `read_file`
- [x] `list_files`
- [ ] `search_files`
- [ ] `file_exists`
- [ ] `write_file`
- [ ] `move_file`
- [ ] `delete_file`

### Git

- [ ] `git_status`
- [ ] `git_diff`
- [ ] `git_log`
- [ ] `git_branch`

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
```

Run the CLI:

```sh
npm run ask -- "What does package.json contain?"
```

Type-check the project:

```sh
npm run build
```

Do not commit `.env`. The `ask` script is the working entrypoint. The `dev` script currently runs `src/main.ts`, which is only a placeholder and does not launch the agent.

## Safety

File tools reject requested paths outside the project and block selected credential-like filenames, including `.env` variants and common key files. Tool inputs are validated with Zod. Leda currently has no write or shell tools.

These checks are an early boundary, not a sandbox or comprehensive secret scanner. In particular, symlink targets are not resolved before reading. Review a project before allowing its file contents to be sent to the model.

## Project status

Leda is an early-stage learning and engineering project. The goal is to progressively build toward a more capable coding agent while keeping implemented features and planned work clearly separated.
