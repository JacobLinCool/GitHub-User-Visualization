import fs from "node:fs";
import os from "node:os";
import ora from "ora";
import { Pool } from "@jacoblincool/puddle";
import { clone, commits } from "./git";
import { graph } from "./graph";

const username = process.argv[2]?.toLowerCase();
if (!username) {
	console.error("Please provide a username");
	process.exit(1);
}

const dir = `data/${username}`;

if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir, { recursive: true });
}

(async () => {
	const spinner = ora();
	const { user, repos, issues } = await graph(username, spinner);

	fs.writeFileSync(`${dir}/user.json`, JSON.stringify(user, null, 2));
	fs.writeFileSync(`${dir}/repos.json`, JSON.stringify(Array.from(repos.values()), null, 2));
	fs.writeFileSync(`${dir}/issues.json`, JSON.stringify(issues, null, 2));

	const clone_pool = new Pool(8);
	const cloning: string[] = [];
	for (const repository of repos) {
		clone_pool.push(async () => {
			cloning.push(repository.name);
			spinner.start(`Cloning ${cloning.join(", ")}`);
			await clone(repository.name, spinner);
			cloning.splice(cloning.indexOf(repository.name), 1);
			if (cloning.length > 0) {
				spinner.start();
			}
		});
	}
	await clone_pool.run();
	spinner.succeed(`Cloned ${repos.length} repositories`);

	const repo_commits: Record<
		string,
		{ sha: string; date: string; message: string; files: string[] }[]
	> = {};

	const checkout_pool = new Pool(os.cpus().length);
	const checking: string[] = [];
	for (const repository of repos) {
		checkout_pool.push(async () => {
			checking.push(repository.name);
			spinner.start(`Checking out commits for ${checking.join(", ")}`);
			repo_commits[repository.name] = (await commits(repository.name, username)).filter(
				(commit) => new Date(commit.date) > new Date(user.created),
			);
			spinner.succeed(`Checked out commits for ${repository.name}`);
			checking.splice(checking.indexOf(repository.name), 1);
			if (checking.length > 0) {
				spinner.start();
			}
		});
	}
	await checkout_pool.run();
	fs.writeFileSync(`${dir}/commits.json`, JSON.stringify(repo_commits, null, 2));
	spinner.succeed(`Checked out commits for ${repos.length} repositories`);
})();
