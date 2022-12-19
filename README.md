# GitHub User Visualization

Visualize GitHub Users!

## Setup

This repository uses dev containers to make it easy to get started. If you are using VS Code, you can open the repository in a container by clicking the popped up button in the lower right corner of the window.

Before you build the website or run the development server, make sure that you have placed user data in the right place.

You can do the following to get started:

1. Create `.env` and put your personal access token as `GITHUB_TOKEN` in it.
2. Run `pnpm move <username>` to move the user data to the right place. (It will automatically fetch the data from GitHub if it is not cached.)
3. Run `pnpm dev` to start the development server.

> How to get a personal access token: https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token

## Usage

You can use this tool to visualize your GitHub profile. You can also use it to visualize other users' profiles.

Simply create a GitHub Actions workflow file in your repository:

```sh
# .github/workflows/vis.yml
name: Visualize

on:
  workflow_dispatch:
  schedule:
    - cron: "0 0 * * *"

jobs:
  vis:
    name: Visualize
    runs-on: ubuntu-latest
    steps:
      - uses: JacobLinCool/GitHub-User-Visualization@main
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          username: ${{ github.repository_owner }} # The username of the user you want to visualize
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN  }}
          publish_dir: "vis"
          publish_branch: "gh-pages"
```

Then, you can run the workflow manually or wait for it to run automatically. The visualization will be published to the `gh-pages` branch. Then, you can access it at `https://<username>.github.io/<repository-name>/`.
