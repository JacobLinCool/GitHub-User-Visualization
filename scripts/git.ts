import fs from "node:fs";
import path from "node:path";
import { exec, execSync } from "node:child_process";
import type { Ora } from "ora";

const CACHE_TIME = Number(process.env.CACHE_TIME) || 1000 * 60 * 60;

const dir = path.resolve("data/_repos");

if (!fs.existsSync(dir)) {
	fs.mkdirSync(dir, { recursive: true });
}

execSync("git config --global core.quotePath false");

export async function clone(fullname: string, spinner?: Ora) {
	const repo = path.join(dir, fullname);
	const exists = fs.existsSync(path.join(repo, ".git"));
	const last = fs.existsSync(path.join(repo, ".git", "FETCH_HEAD"))
		? fs.statSync(path.join(repo, ".git", "FETCH_HEAD")).mtimeMs
		: 0;
	let command: string;
	let cwd: string;
	if (!exists) {
		command = `git clone --bare --filter=blob:none https://github.com/${fullname}.git ${path.join(
			repo,
			".git",
		)}`;
		cwd = path.resolve(dir);
	} else if (Date.now() - last > CACHE_TIME) {
		command = `git fetch --all --prune && git update-ref HEAD FETCH_HEAD`;
		cwd = path.resolve(repo);
	} else {
		spinner?.succeed(`Skipped ${fullname}`);
		return;
	}

	spinner?.start(`${exists ? "Updating" : "Cloning"} ${fullname}`);
	await new Promise<void>((resolve, reject) => {
		const child = exec(command, { cwd });
		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject();
			}
		});
		child?.stdout?.on("data", (data) => {
			if (spinner) {
				spinner.text = `${exists ? "Updating" : "Cloning"} ${fullname} ${data.toString()}`;
			}
		});
		child?.stderr?.on("data", (data) => {
			if (spinner) {
				spinner.text = `${exists ? "Updating" : "Cloning"} ${fullname} ${data.toString()}`;
			}
		});
	});
	spinner?.succeed(`${exists ? "Updated" : "Cloned"} ${fullname}`);
}

export async function commits(
	fullname: string,
	author: string,
): Promise<{ sha: string; date: string; message: string; files: string[] }[]> {
	const repo = path.join(dir, fullname);
	if (!fs.existsSync(repo)) {
		throw new Error("Repository not found");
	}

	const command = `git log --name-only --date=iso --format="%n%n%n%H%n%ad%n%s" -i --author=${author}`;
	const result = await new Promise<string>((resolve, reject) => {
		exec(command, { cwd: repo }, (error, stdout) => {
			if (error) {
				reject(error);
			} else {
				resolve(stdout);
			}
		});
	});

	const commits: { sha: string; date: string; message: string; files: string[] }[] = [];

	for (const block of result.split("\n\n\n")) {
		try {
			const trimmed = block.trim();
			if (!trimmed) {
				continue;
			}
			const [sha, date, message, ...files] = trimmed.split("\n");

			commits.push({
				sha,
				date: new Date(date).toISOString(),
				message,
				files: files.map((file) => file.trim()).filter(Boolean),
			});
		} catch (error) {
			console.log("\n---\n", block, "\n---\n");
			throw error;
		}
	}

	return commits;
}
