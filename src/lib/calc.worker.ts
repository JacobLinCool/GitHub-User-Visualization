import type { Commit, Issue } from "./types";

export type CalcType = "langs" | "types" | "graph";
export interface CalcLangsResult {
	languages: Map<string, number[]>;
	months: Map<string, number>;
}
export type CalcTypesResult = { type_name: string; count: number; color: string }[];
export interface CalcGraphResult {
	self: { name: string; count: number; x: number; y: number; type: string };
	nodes: { name: string; count: number; x: number; y: number; type: string }[];
	links: { source: string; target: string; value: number }[];
	max: number;
}

function calc_langs(commits: Commit[]): CalcLangsResult {
	const all_langs = new Set(
		commits
			.map((commit) => Object.keys(commit.langs))
			.flat()
			.sort(),
	);

	const languages = new Map<string, number[]>();
	for (const lang of all_langs) {
		if (lang === "unknown") {
			continue;
		}
		languages.set(lang, []);
	}
	const months = new Map<string, number>();
	for (const commit of commits) {
		const month = commit.date.toISOString().slice(0, 7);
		if (!months.has(month)) {
			months.set(month, months.size);
			for (const lang of all_langs) {
				languages.get(lang)?.push(0);
			}
		}
		for (const [lang, count] of Object.entries(commit.langs)) {
			const data = languages.get(lang);
			if (data) {
				data[months.get(month) as number] += count;
			}
		}
	}

	return { languages, months };
}

function calc_types(commits: Commit[]): CalcTypesResult {
	const type_total = [
		{ type_name: "test", count: 0, color: "red" },
		{ type_name: "docs", count: 0, color: "orange" },
		{ type_name: "ci", count: 0, color: "blue" },
		{ type_name: "code", count: 0, color: "green" },
		{ type_name: "unknown", count: 0, color: "gray" },
	];

	for (const commit of commits) {
		type_total[0].count += commit.types.test === undefined ? 0 : commit.types.test;
		type_total[1].count += commit.types.docs === undefined ? 0 : commit.types.docs;
		type_total[2].count += commit.types.ci === undefined ? 0 : commit.types.ci;
		type_total[3].count += commit.types.code === undefined ? 0 : commit.types.code;
		type_total[4].count += commit.types.undefined === undefined ? 0 : commit.types.undefined;
	}

	type_total.sort((a, b) => {
		if (a.type_name === "unknown") {
			return 1;
		}
		if (b.type_name === "unknown") {
			return -1;
		}
		return b.count - a.count;
	});

	return type_total;
}

function calc_graph(issues: (Issue & { repo: string })[]): CalcGraphResult {
	const [self, ...others] = Object.entries(
		issues.reduce((acc, issue) => {
			issue.participants.forEach((username) => {
				acc[username] = (acc[username] || 0) + 1;
			});
			return acc;
		}, {} as Record<string, number>),
	)
		.sort((a, b) => b[1] - a[1])
		.map(([name, count], i) => ({
			name,
			count,
			x: 0,
			y: 0,
			type: "user",
		}));

	const repos = Object.entries(
		issues.reduce((acc, issue) => {
			if (issue.repo in acc) {
				acc[issue.repo][0]++;
				for (const username of issue.participants) {
					acc[issue.repo][1][username] = (acc[issue.repo][1][username] || 0) + 1;
				}
			} else {
				acc[issue.repo] = [1, {} as Record<string, number>];
				for (const username of issue.participants) {
					acc[issue.repo][1][username] = 1;
				}
			}
			return acc;
		}, {} as Record<string, [number, Record<string, number>]>),
	)
		.sort((a, b) => b[1][0] - a[1][0])
		.map(([name, [count, users]], i) => ({
			name,
			count,
			x: 0,
			y: 0,
			type: "repo",
			users,
		}));

	const nodes = [self, ...repos, ...others];

	const max = Math.max(...repos.map((other) => other.count), ...others.map((other) => other.count));

	const links = [
		...repos.map((repo) => ({
			source: self.name,
			target: repo.name,
			value: repo.count,
		})),
		...repos
			.map((repo) =>
				Object.entries(repo.users).map(([username, count]) => ({
					source: repo.name,
					target: username,
					value: count,
				})),
			)
			.flat()
			.filter((link) => link.target !== self.name),
	];

	return { self, nodes, links, max };
}

onmessage = async (evt) => {
	const { id, type, data } = evt.data as { id: string; type: CalcType; data: any };

	if (type === "langs") {
		postMessage({ id, data: calc_langs(data) });
	}

	if (type === "types") {
		postMessage({ id, data: calc_types(data) });
	}

	if (type === "graph") {
		postMessage({ id, data: calc_graph(data) });
	}
};

export {};
