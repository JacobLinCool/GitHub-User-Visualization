import type { CalcType, CalcLangsResult, CalcTypesResult, CalcGraphResult } from "./calc.worker";
import type { Commit, Issue } from "./types";

async function run(type: CalcType, data: any) {
	const worker = new (await import("$lib/calc.worker?worker")).default();

	const id = Math.random().toString(36).slice(2);
	worker.postMessage({ id, type, data });

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

async function langs(commits: Commit[]): Promise<CalcLangsResult> {
	return await run("langs", commits);
}

async function types(data: { commits: Commit[]; disabled: Set<string> }): Promise<CalcTypesResult> {
	return await run("types", data);
}

async function graph(data: {
	issues: (Issue & { repo: string })[];
	threshold: number;
}): Promise<CalcGraphResult> {
	return await run("graph", data);
}

export default { run, langs, types, graph };
