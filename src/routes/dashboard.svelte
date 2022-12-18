<script lang="ts">
	import type { Repos, Commits, Issues } from "$lib/types";
	import calc from "$lib/calc";
	import { language_color } from "$lib/ext";
	import * as d3 from "d3";
	import { onMount } from "svelte";

	export let repos: Repos;
	export let commits: Commits;
	export let issues: Issues;

	const repositories = repos.map((repo) => ({ ...repo, selected: true }));
	let [time_start, time_end] = Object.values(commits)
		.flat()
		.reduce(
			([min, max], commit) => [
				d3.min([min, commit.date]) || new Date(0),
				d3.max([max, commit.date]) || new Date(),
			],
			[new Date(), new Date(0)],
		);
	const time_range = [time_start, time_end];
	const time_unit = 1000 * 60 * 60 * 24 * 30;
	const time_units = (time_end.getTime() - time_start.getTime()) / time_unit;

	$: selected_repos = new Set(
		repositories.filter((repo) => repo.selected).map((repo) => repo.name),
	);
	$: selected_commits = Object.entries(commits)
		.filter(([repo]) => selected_repos.has(repo))
		.map(([, commits]) => commits)
		.flat()
		.filter((commit) => commit.date >= time_start && commit.date <= time_end)
		.sort((a, b) => d3.ascending(a.date, b.date));
	$: selected_issues = Object.entries(issues)
		.filter(([repo]) => selected_repos.has(repo))
		.map(([, issues]) => issues)
		.flat()
		.filter((issue) => issue.created >= time_start && issue.created <= time_end)
		.sort((a, b) => d3.ascending(a.created, b.created));

	$: {
		console.log({ repositories, time_start, time_end });
		update_line_chart();
	}

	onMount(async () => {
		await init_line_chart();
		await update_line_chart();
	});

	async function init_line_chart() {
		const time_tag = `init line chart ${new Date().toTimeString()}`;
		console.time(time_tag);

		const element = document.querySelector("#line-chart");

		const margin = { top: 20, right: 20, bottom: 30, left: 50 };
		const width = (element?.clientWidth || 960) - margin.left - margin.right;
		const height = 500 - margin.top - margin.bottom;

		const svg = d3
			.select(element)
			.append("svg")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom);

		svg
			.append("defs")
			.append("svg:clipPath")
			.attr("id", "clip")
			.append("svg:rect")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.attr("x", -margin.left)
			.attr("y", -margin.top);

		const chart = svg
			.append("g")
			.attr("transform", `translate(${margin.left}, ${margin.top})`)
			.attr("clip-path", "url(#clip)");

		chart.append("g").attr("id", "x-axis");
		chart.append("g").attr("id", "y-axis");
		chart.append("rect").attr("id", "zoom");

		console.timeEnd(time_tag);
	}

	let line_chart_updating = false;
	let line_chart_final_state = 0;
	async function update_line_chart() {
		if (line_chart_updating) {
			const desired_state = line_chart_final_state + 1;
			setTimeout(() => {
				if (line_chart_final_state < desired_state) {
					update_line_chart();
				}
			}, 50);
			return;
		}
		line_chart_updating = true;
		line_chart_final_state++;

		if (!selected_commits) {
			return;
		}

		console.log(selected_commits);

		const time_tag = `update line chart ${new Date().toTimeString()}`;
		console.time(time_tag);

		const { languages, months } = await calc.langs(selected_commits);

		const element = document.querySelector("#line-chart");

		const margin = { top: 20, right: 20, bottom: 30, left: 50 };
		const width = (element?.clientWidth || 960) - margin.left - margin.right;
		const height = 500 - margin.top - margin.bottom;

		const chart = d3.select(element).select("svg").select("g");

		const x = d3
			.scaleTime()
			.domain(d3.extent(selected_commits, (commit) => commit.date) as [Date, Date])
			.range([0, width]);

		const y = d3
			.scaleLinear()
			.domain([0, d3.max(languages.values(), (data) => d3.max(data) as number) as number])
			.range([height, 0]);

		chart
			.select<SVGGElement>("#x-axis")
			.attr("transform", `translate(0, ${height})`)
			.call(d3.axisBottom(x));

		chart.select<SVGGElement>("#y-axis").call(d3.axisLeft(y));

		chart.selectAll(".line").remove();

		chart
			.selectAll(".line")
			.data(languages)
			.join("path")
			.attr("class", "line")
			.attr("fill", "none")
			.attr("stroke", ([lang]) => language_color[lang] || "#ccc")
			.attr("stroke-width", 1.5)
			.attr("d", (data) => {
				const iter = months.keys();
				return d3
					.line<number>()
					.x((_, i) => x(new Date(iter.next().value)))
					.y((d) => y(d))(data[1]);
			});

		const sorted_langs = Array.from(languages.entries()).sort(([, a], [, b]) =>
			d3.descending(d3.sum(a), d3.sum(b)),
		);

		chart.selectAll(".legend").remove();

		const legend = chart
			.selectAll(".legend")
			.data(sorted_langs)
			.join("g")
			.attr("class", "legend")
			.attr("transform", (d, i) => `translate(0, ${i * 20})`);

		legend
			.append("rect")
			.attr("x", 10)
			.attr("width", 18)
			.attr("height", 18)
			.style("fill", ([lang]) => language_color[lang] || "#ccc");

		legend
			.append("text")
			.attr("x", 32)
			.attr("y", 9)
			.attr("dy", ".35em")
			.text(([lang]) => lang);

		// x-only zoom
		const zoom = d3
			.zoom<any, any>()
			.scaleExtent([1, time_units])
			.translateExtent([
				[0, -Infinity],
				[time_units * time_unit, Infinity],
			])
			.extent([
				[0, 0],
				[time_units * time_unit, height],
			])
			.on("zoom", (evt) => {
				console.log(evt);

				let new_start = new Date(time_range[0].getTime() + evt.transform.x);
				let new_end = new Date(new_start.getTime() + (time_units * time_unit) / evt.transform.k);

				if (new_start < time_range[0]) {
					new_start = time_range[0];
				}
				if (new_end > time_range[1]) {
					new_end = time_range[1];
				}

				console.log({
					new_start,
					new_end,
					time_start,
					time_end,
				});
				time_start = new_start;
				time_end = new_end;
			});

		chart
			.select<SVGRectElement>("#zoom")
			.attr("width", width)
			.attr("height", height)
			.attr("fill", "none")
			.attr("pointer-events", "all")
			.call(zoom);

		console.timeEnd(time_tag);

		line_chart_updating = false;
	}
</script>

<div
	style="flex: 1; display: flex; flex-direction: column; margin: 0 1rem 1rem 1rem; text-decoration: none; border-radius: 0.5rem; padding: 1rem; background: #f8f8f8"
>
	<div id="line-chart" style="border: #ccc solid 1px" />
</div>
