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
