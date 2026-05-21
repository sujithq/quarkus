---
on:
  workflow_dispatch:

permissions:
  contents: read

engine: copilot
network: defaults

safe-outputs:
  create-issue:
    max: 1

---

# Basic Agent

Create one GitHub issue titled `Hello from the basic agent`.

## Instructions

When this workflow is manually run, create a single issue with:

- Title: `Hello from the basic agent`
- Body: `This issue was created by the most basic agentic workflow example.`
