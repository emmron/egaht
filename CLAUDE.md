# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Eghact Framework

### Overview
Eghact is a revolutionary web framework that replaces React with a cleaner, more efficient approach. It features:
- Compile-time reactivity with zero runtime overhead
- A new component syntax that improves on JSX
- C-based runtime compiled to WebAssembly
- File-based routing
- Built-in state management

### Current Focus
We're building a new component syntax to replace JSX that:
- Is more intuitive and less verbose
- Doesn't require closing tags for every element
- Has better syntax for conditionals and loops
- Supports reactive statements natively
- Compiles to efficient JavaScript

### Task Management Workflow

This project uses task-master for task management. The current workflow is:

1. **View current tasks**: `task-master list`
2. **See next task**: `task-master next`
3. **Start a task**: `task-master set-status --id=<id> --status=in-progress`
4. **Complete a task**: `task-master set-status --id=<id> --status=done`
5. **View task details**: `task-master show <id>`
6. **Expand complex tasks**: `task-master expand --id=<id>`

### Current Task Status
- Task #1 (Core Runtime Development) is currently IN PROGRESS
- We're focusing on designing a new component syntax to replace JSX
- The runtime will be built in C and compiled to WebAssembly

### Development Commands
```bash
# Task management
task-master list                    # View all tasks
task-master next                    # See recommended next task
task-master show <id>               # View task details
task-master set-status --id=<id> --status=<status>  # Update task status

# Project setup (when ready)
npm install                         # Install dependencies
npm run dev                        # Run development server
npm run build                      # Build for production
```

### Architecture Decisions
- **Runtime**: C-based, compiled to WebAssembly for maximum performance
- **Component Syntax**: New syntax to replace JSX (currently being designed)
- **Compiler**: Will use AST transformation to convert components to efficient code
- **State Management**: Built-in reactive system, no external libraries needed
- **Bundle Size Goal**: < 10KB for hello world app

### Key Implementation Notes
- Avoid JSX's className vs class confusion
- Make conditionals and loops first-class citizens in the syntax
- Support reactive declarations ($: from Svelte) natively
- Closing tags should be optional where unambiguous
- Attributes should support both quoted and unquoted values
- Event handlers should be simple (@click not onClick)

### API Key Configuration
The project uses OpenRouter for AI assistance:
- API key is stored in `.env` as `OPENROUTER_API_KEY`
- Default model: google/gemini-2.5-pro