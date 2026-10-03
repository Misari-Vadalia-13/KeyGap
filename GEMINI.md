# Project Instructions: Git Synchronization Workflow

This project is continuously synchronized with the GitHub repository (`https://github.com/Misari-Vadalia-13/KeyGap`).
For all tasks and coding interactions in this workspace, strictly adhere to the following workflow:

1. **Pre-flight Check**: Before making any changes, check `git status` and verify that the current branch is `main` (or the branch requested by the user).
2. **Preserve User Work**: Never run destructive commands (`git reset --hard`, `git checkout --`, `git clean -f`, `git restore`) or overwrite/delete existing work unless explicitly instructed by the user.
3. **Include All Changed Files**: Whenever modifying, creating, deleting, or updating ANY project file, all changes across the project must be tracked together (`git add -A`).
4. **Task-Level Commits**: Do not create separate commits for every individual line or tiny edit. Make exactly one meaningful commit after completing each requested task.
5. **Pre-push Verification**: Before pushing, run `git status` to ensure all intended files (new, modified, and deleted) are staged and no accidental or sensitive files are included.
6. **Automated Commit & Push Sequence**: After completing each requested coding task, execute:
   - `git status`
   - `git add -A`
   - `git commit -m "<Descriptive commit message>"`
   - `git push origin main`
7. **Error Handling**: If the GitHub remote, branch, authentication, or push operation encounters an error, STOP immediately and clearly explain what needs to be fixed. Do not perform force pushes or silent repository resets.
8. **Confirmation**: After every successful push, report the commit message and explicitly confirm to the user that changes were committed and pushed to GitHub.
