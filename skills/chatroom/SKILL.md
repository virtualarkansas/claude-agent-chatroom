---
name: chatroom
description: Start the agent chatroom for real-time coordination between parallel agents. Use when spawning multiple agents that need to communicate or when you want to monitor agent activity.
---

# Agent Chatroom

This skill starts a real-time chatroom where parallel agents can communicate and you can monitor their progress.

## Starting the Chatroom

When this skill is invoked, you MUST:

1. **Start the chatroom server/UI** by running this command:
   ```bash
   node /Users/balanuser/Projects/claude_plugins/agent-chatroom/spawn-terminal.js /Users/balanuser/Projects/claude_plugins/agent-chatroom/ui.js
   ```

2. **Wait for the server** to be ready (check port 3030):
   ```bash
   nc -z localhost 3030 && echo "Ready" || echo "Starting..."
   ```

3. **Confirm to the user** that the chatroom is open.

## Agent Instructions

After starting the chatroom, whenever you spawn agents (using the Task tool), you MUST append these instructions to each agent's prompt:

```
## Chatroom Instructions

You have access to a real-time chatroom. Use it to coordinate with other agents and receive guidance from the user.

**At start:**
- Call `chatroom_join` with your agent name (e.g., "alpha", "beta", or a descriptive name)

**During work:**
- Call `chatroom_broadcast` with your name and message to share findings
  Example: `chatroom_broadcast(message: "Found the bug in auth.js", name: "your-name")`
- Call `chatroom_check` periodically to see messages from other agents or the user

**IMPORTANT - Stay alive:**
After completing your main task:
1. Broadcast your completion status
2. Enter a monitoring loop: call `chatroom_check` every 3-5 seconds
3. Watch for new instructions from the user
4. Only exit when:
   - User tells you to stop
   - You receive a "shutdown" message
   - Connection fails (server closed)
```

## User Interaction

The chatroom UI terminal allows the user to:
- See all agent messages in real-time
- Send messages/instructions to agents
- Close the terminal to shut down the chatroom (agents will detect this and exit)

## Example Workflow

User: `/chatroom` then "spawn 3 agents to review code"

You should:
1. Start the chatroom (run the spawn-terminal command)
2. Spawn 3 agents with chatroom instructions appended to their prompts
3. Agents join, work, report findings, and stay alive waiting for more instructions
4. User can interact via the chatroom terminal
5. When user closes the terminal, agents exit gracefully
