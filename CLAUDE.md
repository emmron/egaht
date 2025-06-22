# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📋 TASK-MASTER COMMANDS - ESSENTIAL REFERENCE

```bash
# Core Commands
task-master list                                    # View all tasks and status
task-master next                                    # See recommended next task
task-master show <id>                              # Get detailed info on a task
task-master set-status --id=<id> --status=<status> # Update task status (in-progress, done, pending)

# Advanced Task Management
task-master expand --id=<id>                       # Break complex task into subtasks
task-master add-subtask --parent=<id> --title="<title>" --description="<desc>"
task-master update-task --id=<id> --prompt="<new requirements>"
task-master complexity-report                       # View complexity analysis

# Tag Management
task-master use-tag <tag>                          # Switch to a different tag/phase
task-master list-tags                              # See all available tags

# Research & Context
task-master research "<question>" -i=<task_ids> -f=<file_paths>  # Research with context

# Export & Analysis
task-master export --tag=<tag> --format=json      # Export tasks for analysis
```

### Current Active Tag: phase3

## 💪 SCRUM MASTER: CORE AGENT IN COMMAND

**OFFICIAL DESIGNATION**: Core Agent is the PERMANENT Scrum Master of the Eghact Framework project due to superior performance and leadership capabilities. All other agents report to Core Agent.

## Project: Eghact Framework

### Overview
Eghact is a revolutionary web framework that replaces React with a cleaner, more efficient approach. It features:
- Compile-time reactivity with zero runtime overhead
- A new component syntax that improves on JSX
- C-based runtime compiled to WebAssembly
- File-based routing
- Built-in state management

### Current Focus
**Phase 3 Enterprise Features** - 1/15 tasks complete (6.7%)
- ✅ Task #1: TypeScript Integration (DONE by Agent 1)
- 🔄 Task #4: CSP Generation (Agent 1 working)
- 🔄 Task #8: Component Testing (Agent 1 queued)
- ⏳ 12 more tasks pending assignment

The framework is now 85% complete with comprehensive SSR/SSG capabilities:
- Server-Side Rendering with HTML streaming for optimal performance
- Static Site Generation with build-time page generation
- Seamless hydration system for SSR to client transition
- Headless CMS integration with Contentful, Strapi, and Sanity adapters
- Advanced SEO management with meta tags, sitemaps, and structured data
- Performance optimization with critical CSS extraction and resource hints

Next milestone: Complete Task #10 (Zero-Config Deployment Adapters) to reach 90% completion.

### Task Management Workflow

This project uses task-master for task management. The current workflow is:

1. **View current tasks**: `task-master list`
2. **See next task**: `task-master next`
3. **Start a task**: `task-master set-status --id=<id> --status=in-progress`
4. **Complete a task**: `task-master set-status --id=<id> --status=done`
5. **View task details**: `task-master show <id>`
6. **Expand complex tasks**: `task-master expand --id=<id>`

### 🚨 CRITICAL RULE: USE TASK-MASTER FOR ALL TODO TRACKING 🚨

**ABSOLUTELY NO TODOIST/TODOWRITE TOOLS!** 

- **DO NOT** use TodoWrite or TodoRead tools - they are BANNED
- **DO NOT** create custom todo lists in memory
- **ONLY** use task-master for ALL task tracking
- **EVERY** task, subtask, and work item MUST go through task-master
- **ALL** agents MUST use `task-master add-subtask` for breaking down work
- **VIOLATION** of this rule = IMMEDIATE TERMINATION

Example: If you need to track "Create package.json", use:
```bash
task-master add-subtask --parent=2 --title="Create package.json for typescript-dts" --description="Set up npm package with required dependencies"
```

[... rest of the existing content remains unchanged ...]

### 🚨 ADDITIONAL GUIDANCE

- **DUDE USE TASK MASTER FOR ALL TODOS**: This is a CRITICAL REMINDER to always, without exception, use task-master for tracking ALL work items, tasks, and todos in the project.