# GitHub repository and Pages setup (Windows)

> Branch name: the commands below use `main`. If your repository uses `Main` (capital M), use that exact spelling everywhere, including **Settings → Pages**. Prefer lowercase `main`: on Windows (case-insensitive) `main` and `Main` cannot coexist.

## A. Create the repository on GitHub

1. Sign in to GitHub.
2. Click **New repository**.
3. Repository name: `weekly-time-planner`.
4. For the simplest GitHub Free setup, choose **Public**. GitHub Pages on GitHub Free requires a public repository.
5. Do not initialize with a README, `.gitignore`, or license because this project folder already contains them.
6. Click **Create repository**.

> GitHub Pages publishes a website that is publicly reachable. Do not commit personal JSON data or secrets.

## B. Prepare the folder

1. Extract `weekly-time-planner-github-pages.zip`.
2. Open the extracted `weekly-time-planner-github-pages` folder.
3. Confirm that `index.html`, `README.md`, `.gitignore`, and `service-worker.js` are directly inside it (not one folder deeper).

## C. Install Git (if needed)

Install Git for Windows from https://git-scm.com/download/win. Open Git Bash after installation.

Check:

```bash
git --version
```

If this is the first time you use Git on this computer, set the name and email that will appear on your commits:

```bash
git config --global user.name "Your Name"
git config --global user.email "YOUR_EMAIL@example.com"
```

## D. Connect the folder to the GitHub repository

In Git Bash, move to the extracted folder. Example:

```bash
cd /c/Users/YOUR_WINDOWS_USER/Downloads/weekly-time-planner-github-pages
```

Initialize and commit:

```bash
git init -b main
git status
git add .
git status
git commit -m "chore: initialize weekly time planner v3.6"
```

Add the remote (replace `YOUR-USERNAME`):

```bash
git remote add origin https://github.com/YOUR-USERNAME/weekly-time-planner.git
git remote -v
git push -u origin main
```

GitHub may open a browser sign-in flow. Complete it. Do not paste a personal access token into source files.

## E. Enable GitHub Pages

1. Open the repository on GitHub.
2. Select **Settings**.
3. In the left sidebar, select **Pages**.
4. Under **Build and deployment → Source**, select **Deploy from a branch**.
5. Under **Branch**, select `main`.
6. Under the folder dropdown, select `/(root)`.
7. Click **Save**.
8. Wait for the deployment. The Pages screen will show the published URL.

For this project repository, the expected URL format is:

```text
https://YOUR-USERNAME.github.io/weekly-time-planner/
```

## F. Verify the deployed site

Open the URL and check:
- The planner loads with its Arabic UI.
- CSS and JavaScript loaded (no unstyled page).
- Add/edit/delete a test task.
- Reload and confirm local browser data remains.
- The browser reports that the service worker is registered.
- After the first successful online load, test Offline mode.
- Test installation from the browser's install option / Add to Home Screen.

## G. Publish future code changes

After editing files in this folder:

```bash
git status
git add .
git commit -m "fix: describe the fix"
git push
```

GitHub Pages will publish the new commit automatically. Check the repository's **Actions** tab if deployment does not complete.

## H. Work from another computer

Clone the repository once:

```bash
git clone https://github.com/YOUR-USERNAME/weekly-time-planner.git
cd weekly-time-planner
```

Before making edits to an existing clone:

```bash
git pull
```

After editing:

```bash
git add .
git commit -m "feat: describe the feature"
git push
```

## Common problems

- **404:** verify Pages uses `main` and `/(root)`, and `index.html` is at repository root.
- **Page appears without styling:** verify `src/css/app.css` was committed and the path is exactly correct.
- **Old version still appears:** hard refresh the browser; close/reopen an installed PWA. For a new release, bump the cache version in `service-worker.js`.
- **Personal data not present:** this is expected on a new GitHub Pages origin. Export JSON from the old local copy and import it into the hosted copy.
- **Private repository:** on GitHub Free, Pages requires a public repository. Also, Pages sites are publicly reachable; a private repository does not automatically make the published site private.
