import type { Commit } from "./types";

export type CalcType = "langs" | "types";
export interface CalcLangsResult {
	languages: Map<string, number[]>;
	months: Map<string, number>;
}
export type CalcTypesResult = { type_name: string; count: number; color: string }[];

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

onmessage = async (evt) => {
	const { id, type, data } = evt.data as { id: string; type: CalcType; data: any };

	if (type === "langs") {
		postMessage({ id, data: calc_langs(data) });
	}

	if (type === "types") {
		postMessage({ id, data: calc_types(data) });
	}
};

export {};
