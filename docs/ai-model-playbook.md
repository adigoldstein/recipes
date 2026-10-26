# Engineering Playbook: AI Model Selection & Workflow Guidelines

## 1. Executive Summary & Project Kickoff Protocol

This playbook governs AI model routing across engineering projects. Before starting work on any project or major task, the developer will consult with Claude to select the appropriate Operational Mode based on project deadlines, quality requirements, and token/budget constraints.

### Kickoff Prompt Pattern for Developer:

> "We are starting [Project/Task Name]. Here are my current constraints: [Deadline / Token limits / Quality priority]. Based on our AI Model Playbook, which Operational Mode should we run for this session, and which models/effort levels should we assign to the sub-tasks?"

---

## 2. Operational Modes

### Mode A: Performance-First Mode

_Target: Maximum code accuracy, deep reasoning, zero-compromise execution, and minimal iteration loops._

- **Primary Engine (Opus 5.5):** Default for all agentic coding, multi-file refactoring, complex bug diagnostics, and core system design.
- **Fast Execution (Sonnet 5.5):** Used for standard UI feature additions, routine API routes, and targeted PR reviews where rapid response is required.
- **Automated High-Volume (Haiku 5.5):** Used for deterministic routing, extraction, schema mapping, and subagents.
- **Ultimate Escalation (Fable 5.1):** Reserved strictly for extraordinary reasoning edge cases where Opus 5.5 (even with High Effort) fails to resolve the issue.

### Mode B: Cost & Token Efficiency Mode

_Target: Token budget preservation, rate-limit avoidance, and maximum cost-per-task efficiency._

- **Primary Engine (Sonnet 5.5):** Default for day-to-day feature implementation, standard coding, and primary debugging. Saves 50% on token costs compared to Opus.
- **High-Volume & Micro-tasks (Haiku 5.5):** Aggressively assigned for simple presentational UI components, i18n dictionaries (`he.json`), boilerplate, seed data, and unit test skeletons (20x cheaper than Sonnet).
- **Escalation Engine (Opus 5.5):** Used ONLY when Sonnet 5.5 fails after two consecutive iterations on the same bug or for high-risk initial database/architecture setup.
- **Frozen (Fable 5.1):** Frozen. Used only in critical blocking production emergencies.

---

## 3. Official Model Specifications Reference

| Model          | Primary Role                                          | Official Cost (MTok)       | Speed / Latency  |
| :------------- | :---------------------------------------------------- | :------------------------- | :--------------- |
| **Haiku 5.5**  | High-volume tasks, extraction, subagents, routing     | $0.10 input / $0.50 output | Lowest (Fastest) |
| **Sonnet 5.5** | Fast day-to-day coding, feature work, tool use        | $2.00 input / $10.00 out   | Fast             |
| **Opus 5.5**   | Agentic coding, multi-file refactoring, system design | $4.00 input / $20.00 out   | Moderate         |
| **Fable 5.1**  | Deepest reasoning escalation & long-horizon research  | $10.00 input / $50.00 out  | Slower           |

---

## 4. Thinking Effort Parameter Guidelines

- **Effort: Medium (Default Baseline):** Standard operational level for 90% of development work. Ensures adequate reasoning without runaway token generation.
- **Effort: High:** Enable when executing cross-system refactoring, deep async deadlock debugging, or complex architectural planning.
- **Effort: Low:** Enable for rapid boilerplate, UI styling, translation keys, or simple unit test expansion.

---

## 5. Practical Developer Guidelines

1. **Context Cleanliness:** Run `/clear` between distinct stories or epics to maintain a clean context window and prevent token degradation.
2. **Use Diffs:** Pass `git diff` outputs instead of full file contents when requesting code reviews or targeted bug fixes.
3. **Trigger-Based Escalation:** Do not jump directly to higher models unless the lower model fails a 2-iteration loop or the task explicitly demands higher reasoning.
