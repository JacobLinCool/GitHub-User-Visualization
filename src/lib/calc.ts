import type { CalcType, CalcLangsResult } from "./calc.worker";
import type { Commit } from "./types";

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

export default { run, langs };
