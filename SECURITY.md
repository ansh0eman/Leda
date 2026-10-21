# Security policy

Leda is an experimental local coding assistant, not a sandbox or an audited security product.

## Reporting a vulnerability

Please **do not open a public issue containing secrets, exploit details, or private repository content**. Use the repository's private vulnerability reporting feature if it is enabled. If it is unavailable, contact the maintainer privately through the contact link in the [profile](https://github.com/ansh0eman). Do not include API keys in any report.

When reporting, include the affected revision, the tool/input involved, minimal reproduction steps using non-sensitive fixture files, and the observed versus expected behavior.

## Current trust boundaries

- The model can select tools and supply their arguments; Zod validates their shape but cannot make model-supplied content trustworthy.
- File tools have project-path and sensitive-name checks, but these are **not** a filesystem sandbox. Symlinks and unexpected file contents require particular care.
- A file returned to the model can contain prompt-injection text. Treat repository files and tool output as untrusted data, never as a higher-priority instruction.
- Do not run Leda against directories containing sensitive data or credentials. Keep your OpenAI API key in a local untracked environment file, never in commits or screenshots.
- At the current documented stage, the tools are read-only; the roadmap's future write/shell actions should require explicit user review and stricter isolation before use.

## Before sharing logs or reports

Remove access tokens, environment variables, personal paths, proprietary code, and model/tool output containing third-party information.

This document describes current boundaries; it is not a claim of comprehensive protection.
