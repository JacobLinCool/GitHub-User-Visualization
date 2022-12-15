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

	for (const repository of repos) {
		await clone(repository.name, spinner);
	}
	spinner.succeed(`Cloned ${repos.length} repositories`);

	const repo_commits: Record<
		string,
		{ sha: string; date: string; message: string; files: string[] }[]
	> = {};

	const pool = new Pool(os.cpus().length);
	const checking: string[] = [];
	for (const repository of repos) {
		pool.push(async () => {
			checking.push(repository.name);
			spinner.start(`Checking out commits for ${checking}`);
			repo_commits[repository.name] = await commits(repository.name, username);
			spinner.succeed(`Checked out commits for ${repository.name}`);
			checking.splice(checking.indexOf(repository.name), 1);
		});
	}
	await pool.run();
	fs.writeFileSync(`${dir}/commits.json`, JSON.stringify(repo_commits, null, 2));
	spinner.succeed(`Checked out commits for ${repos.length} repositories`);
})();
