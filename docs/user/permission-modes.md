# Permission modes

Permission modes control when an agent needs your approval to act. Choose a mode in the message
composer; it applies to that thread.

Set the default for new threads in **Settings → General → New threads → Permissions**.
Projects can override the environment default. New threads use this setting rather than the
mode of the thread you were viewing. The initial default is **Full access**; existing threads
and modes you choose in a draft keep their permissions.

| Mode                  | Behavior                                                                     |
| --------------------- | ---------------------------------------------------------------------------- |
| **Supervised**        | Requests approval for commands and file changes.                             |
| **Auto-accept edits** | Approves file edits automatically; other actions can still require approval. |
| **Full access**       | Allows commands and edits without approval prompts.                          |

Pi does not expose an AI approval reviewer, so the **Auto** option is not offered.
Threads that already stored Auto run and display as **Supervised**.

Approve or reject requests in the conversation to let the agent continue. Permission modes do
not prevent the agent from asking questions about the task.

## Provider differences

Pi enforces the selected mode through its blocking tool hook: read-only tools
continue in **Supervised**, and edit and write tools run in **Auto-accept edits**
while commands and extension tools still ask. The mode is a policy over Pi tool
calls, not an operating-system sandbox; code that a trusted Pi extension runs
outside a tool call stays governed by Pi's own extension trust model.

Changing the mode restarts the Pi provider session and resumes the same native
conversation. See the [Pi guide](./providers-pi.md#permission-modes) for details.
