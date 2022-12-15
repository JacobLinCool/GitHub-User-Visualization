import type { Commits, Issues, Repos, User } from "./types";

let _commits: Commits;
async function commits(): Promise<Commits> {
	if (!_commits) {
		_commits = await fetch("./data/commits.json").then((res) => res.json());
		for (const commits of Object.values(_commits)) {
			for (const commit of commits) {
				commit.date = new Date(commit.date);
			}
		}
	}
	return _commits;
}

let _issues: Issues;
async function issues(): Promise<Issues> {
	if (!_issues) {
		_issues = await fetch("./data/issues.json").then((res) => res.json());
		for (const issues of Object.values(_issues)) {
			for (const issue of issues) {
				issue.created = new Date(issue.created);
			}
		}
	}
	return _issues;
}

let _repos: Repos;
async function repos(): Promise<Repos> {
	if (!_repos) {
		_repos = await fetch("./data/repos.json").then((res) => res.json());
	}
	return _repos;
}

let _user: User;
async function user(): Promise<User> {
	if (!_user) {
		_user = await fetch("./data/user.json").then((res) => res.json());
		_user.created = new Date(_user.created);
	}
	return _user;
}

export default { user, commits, issues, repos };
