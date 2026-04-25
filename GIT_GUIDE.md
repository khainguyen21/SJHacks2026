# Git Commands Guide

A comprehensive guide to the git commands used in this project. This covers what each command does, how to use it, and how they fit together in a typical development workflow.

---

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Core Commands](#core-commands)
3. [Common Workflows](#common-workflows)
4. [Pull Request Workflow](#pull-request-workflow)

---

## Initial Setup

### `git config`

Configures your git identity and preferences. This must be done before making commits so your contributions are properly attributed.

```bash
# Set your name (used in commit history)
git config --global user.name "Your Name"

# Set your email (should match your GitHub email)
git config --global user.email "youremail@example.com"
```

### `git config --global --list`

Displays all of your global git configuration settings. Use this to verify your setup is correct.

```bash
git config --global --list
```

Example output:

```
user.name=Your Name
user.email=youremail@example.com
core.editor=vim
```

---

## Core Commands

### `git status`

Shows the current state of your working directory and staging area. It tells you which files have been modified, which are staged for commit, and which are untracked.

```bash
git status
```

Example output:

```
On branch dominic-barker
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
        modified:   Main.java

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        GIT_GUIDE.md
```

**When to use:** Run this frequently to understand what state your working directory is in before staging, committing, or switching branches.

---

### `git fetch`

Downloads new commits, branches, and tags from the remote repository **without** modifying your local files. It updates your remote-tracking branches (e.g., `origin/main`) so you can see what others have pushed.

```bash
# Fetch all updates from the remote
git fetch

# Fetch from a specific remote
git fetch origin
```

**Key point:** `git fetch` is safe — it never changes your working directory or current branch. It only updates your knowledge of what the remote looks like.

---

### `git pull`

Fetches changes from the remote **and** merges them into your current branch. This is essentially `git fetch` + `git merge` in one step.

```bash
# Pull updates for your current branch
git pull

# Pull from a specific remote and branch
git pull origin main
```

**When to use:** Before starting new work, pull the latest changes to make sure your branch is up to date.

**Warning:** If you have uncommitted local changes that conflict with the incoming changes, git will stop and ask you to resolve the conflicts.

---

### `git add`

Stages files for the next commit. Staging is the step between modifying a file and committing it — it lets you choose exactly which changes to include in your commit.

```bash
# Stage a specific file
git add Main.java

# Stage multiple specific files
git add Main.java GIT_GUIDE.md

# Stage all changed and new files in the current directory
git add .

# Stage all changed and new files in the entire repository
git add -A
```

**Key point:** Modifying a file does not automatically include it in your next commit. You must explicitly stage it with `git add`.

---

### `git restore`

Unstages files or discards uncommitted changes. This command has both safe and destructive usages.

**Safe — Unstage a file (keeps your changes, just removes it from staging):**
```bash
git restore --staged Main.java
```

**DESTRUCTIVE — Discard local changes to a file:**
```bash
git restore Main.java
```
> **DANGER: This permanently deletes your uncommitted changes to that file. There is no undo. If you haven't committed or stashed your work, it is gone forever.**

**DESTRUCTIVE — Discard ALL local changes:**
```bash
git restore .
```
> **DANGER: This permanently deletes ALL uncommitted changes across every file in the current directory. There is no confirmation prompt. Make absolutely sure your work is committed or stashed before running this.**

---

### `git rm`

Removes a file from git tracking. The removal will be recorded in the next commit.

**Safe — Stop tracking a file but keep it on disk:**
```bash
git rm --cached oldfile.java
```

**DESTRUCTIVE — Remove a file from the repo AND delete it from disk:**
```bash
git rm oldfile.java
```
> **DANGER: This deletes the file from your computer. If the file has uncommitted changes, they will be lost.**

**DESTRUCTIVE — Remove an entire directory from the repo AND delete it from disk:**
```bash
git rm -r old-directory/
```
> **DANGER: This recursively deletes the directory and all its contents from your computer. Double-check the path before running this.**

**When to use:** When you need to delete a file and have that deletion tracked by git. Simply deleting a file with `rm` will show it as "deleted" in `git status`, but you still need to stage that deletion with `git add` or use `git rm` instead.

---

### `git commit`

Records the staged changes as a new commit in the repository history. Every commit should have a clear, descriptive message explaining **what** changed and **why**.

```bash
# Commit with an inline message
git commit -m "Add rock-paper-scissors game logic"

# Commit with a multi-line message (opens your editor)
git commit

# Stage all tracked modified files and commit in one step
git commit -am "Fix scoring bug in Main.java"
```

**Commit message best practices:**
- Use the imperative mood: "Add feature" not "Added feature"
- Keep the first line under 72 characters
- Reference the issue number if applicable: "Fix scoring bug (#12)"

---

### `git push`

Uploads your local commits to the remote repository so others can see your work.

```bash
# Push the current branch to the remote
git push

# Push a specific branch
git push origin dominic-barker

# Push and set the upstream tracking branch (first push of a new branch)
git push -u origin your-branch-name
```

**Key point:** You must commit your changes locally before you can push them. `git push` sends commits, not individual file changes.

---

### `git checkout`

Switches between branches or restores files. This is how you move between different lines of development.

**Safe — Switch to an existing branch:**
```bash
git checkout main
```

**Safe — Create a new branch and switch to it:**
```bash
git checkout -b new-feature-branch
```

**DESTRUCTIVE — Restore a specific file to its last committed state:**
```bash
git checkout -- Main.java
```
> **DANGER: This permanently deletes your uncommitted changes to that file — identical to `git restore Main.java`. There is no undo. Make sure your work is committed or stashed first.**

**When to use:**
- Switching to `main` before pulling the latest changes
- Creating a new feature branch for your work
- Switching between branches when working on multiple features

---

### `git branch`

Lists, creates, or deletes branches. Branches let you work on features independently without affecting `main`.

```bash
**Safe — List and create branches:**
```bash
# List all local branches (current branch marked with *)
git branch

# List all branches including remote branches
git branch -a

# Create a new branch (does not switch to it)
git branch new-feature
```

**Safe — Delete a branch that has already been merged:**
```bash
git branch -d old-branch
```

**DESTRUCTIVE — Force delete a branch (even if it has unmerged work):**
```bash
git branch -D old-branch
```
> **DANGER: This deletes the branch even if it contains commits that haven't been merged anywhere. If those commits exist only on that branch, they are effectively lost.
```

---

### `git log`

Shows the commit history for the current branch. Useful for reviewing what changes have been made and by whom.

```bash
# Show full commit log
git log

# Show a condensed one-line-per-commit log
git log --oneline

# Show the last 5 commits
git log -5

# Show a graphical branch history
git log --oneline --graph --all
```

Example output for `git log --oneline`:

```
139b0c5 Added 4th Print Line
e5fedaf Added third print line
f6d683b Added second print line
dd0452d Delete cs-151-rock-paper-scissors.iml
```

---

### `git reflog`

Shows a log of every recent action that moved `HEAD` — commits, pulls, merges, resets, checkouts, and more. Each entry includes a commit hash you can use to go back to that state. Think of it as your personal undo history.

```bash
# Show the reflog
git reflog

# Show only the last 10 entries
git reflog -10
```

Example output:

```
c2323a9 HEAD@{0}: pull origin hao-van-vo: Fast-forward
b6fd99f HEAD@{1}: reset: moving to origin/main
b6fd99f HEAD@{2}: pull origin main: Fast-forward
70284ce HEAD@{3}: commit: Add .idea/ and *.iml to gitignore
```

**When to use:** When you need to find a previous state of your branch — especially after an accidental pull, merge, or reset. The reflog is your safety net for recovering from mistakes.

**Key point:** The reflog is local only. It is not shared with the remote and entries expire after 90 days by default.

---

### `git reset`

Moves your branch pointer to a different commit. This can be used to undo commits, unstage files, or revert your branch to a previous state.

**Safe — Unstage all files (keeps your changes):**
```bash
git reset
```

**Safe — Undo the last commit but keep the changes in your working directory:**
```bash
git reset --soft HEAD~1
```

**DESTRUCTIVE — Undo the last commit and discard all changes:**
```bash
git reset --hard HEAD~1
```
> **DANGER: This permanently deletes the commit and all associated changes. There is no undo.**

**DESTRUCTIVE — Reset your branch to a specific commit (found via `git reflog`):**
```bash
git reset --hard <commit-hash>
```
> **DANGER: All commits after the target are discarded along with any uncommitted changes. Double-check the commit hash with `git reflog` before running this.**

**When to use:** To undo an accidental pull or merge, or to move your branch back to a known good state. Always use `git reflog` first to find the right commit hash.

---

## Project Structure

In this project, every team member has been assigned **their own branch named after them** (e.g., `dominic-barker`, `jane-smith`). You will do all of your work on your personal branch. **Do not create new branches** — just use the one assigned to you.

Tasks are assigned through **GitHub Issues**. When you are assigned an issue, you will make commits on your branch to address it. Once your fix is complete, you will open a **Pull Request to `main`**. The project maintainer will then review your PR and either merge it or request changes.

---

## Common Workflows

### Switching to Your Branch

If you are not already on your branch, switch to it:

```bash
# Switch to your personal branch
git checkout your-name
# Example:
git checkout dominic-barker
```

### Updating Your Local Repository

Before starting work on an issue, make sure your branch has the latest changes from `main`:

```bash
# 1. Switch to your branch (if not already on it)
git checkout your-name

# 2. Pull the latest changes from main into your branch
git pull origin main
```

This ensures you are working with the most up-to-date version of the project.

### Staging and Committing Changes

After making changes to your code:

```bash
# 1. Check what has changed
git status

# 2. Review your changes (optional but recommended)
git log --oneline

# 3. Stage the files you want to commit
git add Main.java

# OR stage all changed files at once
git add .
```

**Note on `git add .`:** This stages every changed and new file in the current directory. You might worry about accidentally staging files that shouldn't be committed (like compiled `.class` files or IDE configuration folders). This is where the `.gitignore` file comes in — any files or directories listed in `.gitignore` are automatically excluded from staging. The `.gitignore` for this project is already set up to filter out build artifacts and IDE files, so `git add .` will only stage the correct project files.

```bash
# 4. Verify what is staged
git status

# 5. Commit with a descriptive message referencing the issue
git commit -m "Add user input handling for rock-paper-scissors (#5)"
```

### Pushing Your Work

After committing locally, push to your branch on the remote:

```bash
git push origin your-name
# Example:
git push origin dominic-barker
```

### Undoing Mistakes

**Safe — Unstage a file you accidentally staged (keeps your changes):**
```bash
git restore --staged Main.java
```

**Safe — See what you're about to commit:**
```bash
git status
```

**DESTRUCTIVE — Discard local changes to a file:**
```bash
git restore Main.java
```
> **DANGER: This permanently deletes your uncommitted changes to that file. There is no undo.**

**DESTRUCTIVE — Discard ALL local changes and match the remote branch exactly:**
```bash
git fetch origin
git reset --hard origin/your-name
```
> **DANGER: This is the most destructive command in this guide. It permanently deletes ALL uncommitted and staged changes across every file and resets your branch to exactly match the remote. There is no undo. Only use this as an absolute last resort when you want to completely start over from the remote state.**

**DESTRUCTIVE — Undo a pull/merge and revert your branch to a previous state:**

If you accidentally pulled the wrong branch into yours (e.g., `git pull origin someone-elses-branch`), you can use `git reflog` and `git reset --hard` to go back to where you were before the pull.

```bash
# 1. View recent history of where HEAD has been
git reflog

# Example output:
# c2323a9 HEAD@{0}: pull origin hao-van-vo: Fast-forward
# b6fd99f HEAD@{1}: reset: moving to origin/main

# 2. Find the entry BEFORE the unwanted pull (HEAD@{1} in this example)
#    and reset to that commit
git reset --hard b6fd99f
```

> **DANGER: `git reset --hard` permanently discards all commits after the target and any uncommitted changes. Make sure you are resetting to the correct commit. Double-check with `git reflog` before running the reset.**

**Tips:**
- `git reflog` shows every recent action (commits, pulls, resets, checkouts) with a corresponding commit hash — it is your safety net for finding previous states
- The reflog entry just **before** the unwanted action is typically the one you want to reset to
- If you have already pushed the unwanted commits to the remote, you will need `git push --force` after the reset (coordinate with your team before force-pushing)

---

## Pull Request Workflow

This is the expected process for addressing an assigned issue and getting your changes merged into `main`.

### Step 1: Update Your Branch

Make sure your branch has the latest code from `main`:

```bash
git checkout your-name
git pull origin main
```

### Step 2: Work on the Issue

Read the assigned GitHub Issue carefully. Make the necessary code changes on your branch, then stage and commit:

```bash
# Check your changes
git status

# Stage your changes
git add Main.java

# Commit with a message referencing the issue number
git commit -m "Fix scoring bug (closes #12)"
```

You can make multiple commits as you work. Each commit should represent a logical unit of change.

### Step 3: Push Your Branch

```bash
git push origin your-name
```

### Step 4: Create the Pull Request on GitHub

1. Go to the repository on GitHub
2. Click **"Compare & pull request"** (or go to the Pull Requests tab and click **"New pull request"**)
3. Set the **base** branch to `main` and the **compare** branch to **your branch** (e.g., `dominic-barker`)
4. Fill in the PR details:
   - **Title:** A clear summary of what the PR does (e.g., "Fix scoring bug")
   - **Description:** Explain what you changed, why, and reference the issue using `Closes #12` so it automatically closes when merged
5. Click **"Create pull request"**

### Step 5: Wait for Review

The project maintainer will review your PR. There are two possible outcomes:

- **Approved and merged** — your changes are now in `main`. Pull the latest to stay in sync:
  ```bash
  git pull origin main
  ```
- **Changes requested** — the maintainer will leave comments explaining what needs to be fixed (e.g., code doesn't compile, logic error, etc.). Make the fixes on your branch, commit, and push again:
  ```bash
  # Fix the issues locally, then:
  git add Main.java
  git commit -m "Address review feedback: fix compilation error"
  git push origin your-name
  ```
  The PR updates automatically with your new commits. No need to create a new PR.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `git status` | See what has changed |
| `git fetch` | Download remote updates (no merge) |
| `git pull` | Download and merge remote updates |
| `git add <file>` | Stage a file for commit |
| `git restore <file>` | Discard local changes |
| `git restore --staged <file>` | Unstage a file |
| `git rm <file>` | Remove a file from the repo |
| `git commit -m "msg"` | Commit staged changes |
| `git push` | Upload commits to remote |
| `git checkout <branch>` | Switch branches |
| `git checkout -b <branch>` | Create and switch to new branch |
| `git branch` | List branches |
| `git log --oneline` | View commit history |
| `git reflog` | View history of all HEAD movements |
| `git reset --hard <hash>` | Reset branch to a specific commit |
| `git config --global --list` | View git configuration |
