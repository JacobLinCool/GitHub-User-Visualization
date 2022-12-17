import type { Commits, Issues, Repos, User } from "./types";

async function run(type: "user" | "commits" | "issues" | "repos") {
	const worker = new (await import("$lib/data.worker?worker")).default();

	const id = Math.random().toString(36).slice(2);
	worker.postMessage({ id, type });

	return new Promise<any>((resolve, reject) => {
		worker.onmessage = (evt: MessageEvent<{ id: string; data: unknown }>) => {
			if (evt.data.id === id) {
				resolve(evt.data.data);
			}
		};
		worker.onerror = (err) => {
			reject(err);
		};
	});
}

async function commits(): Promise<Commits> {
	return await run("commits");
}

async function issues(): Promise<Issues> {
	return await run("issues");
}

async function repos(): Promise<Repos> {
	return await run("repos");
}

async function user(): Promise<User> {
	return await run("user");
}

export default { run, user, commits, issues, repos };
