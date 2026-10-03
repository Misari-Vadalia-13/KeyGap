# Git Synchronization Workflow Rule

Strictly apply the following rules to every task in this workspace:

1. **Verify Branch Before Changes**:
   - Run `git status` before starting modifications to confirm we are working on the active target branch (`main`).

2. **Full Project Tracking**:
   - Whenever any project file is modified, created, or deleted, stage all changed files together using `git add -A`.

3. **Task Completion Routine**:
   - Complete the entire user-requested task first.
   - Run:
     1. `git status`
     2. `git add -A`
     3. `git commit -m "<Clear, meaningful description of the completed task>"`
     4. `git push origin main`

4. **Safety & Verification**:
   - Ensure new files, modified files, and deleted files are all captured.
   - Never run commands that overwrite, reset, revert, or discard user work without explicit instruction.
   - If authentication, remote, or push errors occur, stop and explain the exact error to the user.

5. **Post-Push Notification**:
   - State the commit message clearly and confirm that the commit was successfully pushed to GitHub.
