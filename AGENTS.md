# Instructions for Agents

## Commit and Publication Protocol

*   **DO NOT** automatically commit changes or call the `submit` tool upon completing a task logic.
*   **ALWAYS** pause after completing the code changes and verifying them.
*   **ASK** the user for explicit permission to commit/publish the changes.
*   Present a summary of the changes made and ask: "Are you ready for me to commit and publish these changes? Do you want to use a specific branch name?"
*   Only proceed to `submit` after the user confirms (e.g., "yes", "commit", "publish").
*   If the user provides a branch name, use that branch name when calling `submit`.
