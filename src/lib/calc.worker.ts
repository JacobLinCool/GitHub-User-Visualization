import type { Commit } from "./types";

export type CalcType = "langs";
export interface CalcLangsResult {
	languages: Map<string, number[]>;
	months: Map<string, number>;
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

onmessage = async (evt) => {
	const { id, type, data } = evt.data as { id: string; type: CalcType; data: any };

	if (type === "langs") {
		postMessage({ id, data: calc_langs(data) });
	}
};

export {};
