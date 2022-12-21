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
		update_bar_chart();
	}

	onMount(async () => {
		await init_line_chart();
		await update_line_chart();
		await init_bar_chart();
		await update_bar_chart();
	});

	async function init_line_chart() {
		const time_tag = `init line chart ${new Date().toTimeString()}`;
		console.time(time_tag);

		const element = document.querySelector("#line-chart");

		const margin = { top: 20, right: 20, bottom: 30, left: 50 };
		const width = (element?.clientWidth || 960) - margin.left - margin.right;
		const height = 400 - margin.top - margin.bottom;

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
	async function update_line_chart(state = line_chart_final_state + 1) {
		if (line_chart_updating) {
			setTimeout(() => {
				if (line_chart_final_state < state) {
					update_line_chart(state);
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
		const height = 400 - margin.top - margin.bottom;

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
				console.log(evt.transform);

				let new_start = new Date(
					time_range[0].getTime() - ((evt.transform.x / 10) * time_unit) / evt.transform.k,
				);
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

	async function init_bar_chart() {
		const time_tag = `init bar chart ${new Date().toTimeString()}`;
		console.time(time_tag);

		const element = document.querySelector("#bar-chart");

		const margin = { top: 20, right: 20, bottom: 30, left: 50 };
		const width = (element?.clientWidth || 960) - margin.left - margin.right;
		const height = 400 - margin.top - margin.bottom;

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

		console.timeEnd(time_tag);
	}

	let bar_chart_updating = false;
	let bar_chart_final_state = 0;
	async function update_bar_chart(state = bar_chart_final_state + 1) {
		if (bar_chart_updating) {
			setTimeout(() => {
				if (bar_chart_final_state < state) {
					update_bar_chart(state);
				}
			}, 50);
			return;
		}
		bar_chart_updating = true;
		bar_chart_final_state++;

		const type_total = [
			{ type_name: "test", count: 0, color: "red" },
			{ type_name: "docs", count: 0, color: "orange" },
			{ type_name: "ci", count: 0, color: "blue" },
			{ type_name: "code", count: 0, color: "green" },
			{ type_name: "undefined", count: 0, color: "gray" },
		];

		selected_commits.forEach((element) => {
			type_total[0].count += element.types.test === undefined ? 0 : element.types.test;
			type_total[1].count += element.types.docs === undefined ? 0 : element.types.docs;
			type_total[2].count += element.types.ci === undefined ? 0 : element.types.ci;
			type_total[3].count += element.types.code === undefined ? 0 : element.types.code;
			type_total[4].count += element.types.undefined === undefined ? 0 : element.types.undefined;
		});

		type_total.sort((a, b) => {
			if (a.type_name == "undefined") return 1;
			if (b.type_name == "undefined") return 0;
			return b.count - a.count;
		});

		const element = document.querySelector("#bar-chart");

		const margin = { top: 20, right: 20, bottom: 30, left: 50 };
		const width = (element?.clientWidth || 960) - margin.left - margin.right;
		const height = 400 - margin.top - margin.bottom;

		const x_name = d3
			.scaleBand()
			.domain(type_total.map((d) => d.type_name))
			.range([0, width]);
		const x_pos = d3.scaleLinear().domain([0, 5]).range([0, width]);

		const y = d3
			.scaleLinear()
			.domain([0, d3.max(type_total.values(), (data) => data.count) as number])
			.range([height, 0]);

		const chart = d3.select(element).select("svg").select("g");

		chart.selectAll("rect").remove();

		chart
			.selectAll("rect")
			.data(type_total)
			.join("rect")
			.attr("x", (data, i) => x_pos(i) + 45)
			.attr("y", (data) => y(data.count))
			.attr("width", 30)
			.attr("height", (data) => height - y(data.count))
			.attr("fill", (data) => data.color);

		chart
			.select<SVGGElement>("#x-axis")
			.attr("transform", `translate(0, ${height})`)
			.call(d3.axisBottom(x_name));

		chart.select<SVGGElement>("#y-axis").call(d3.axisLeft(y));

		chart.selectAll(".legend").remove();

		const legend = chart
			.selectAll(".legend")
			.data(type_total)
			.join("g")
			.attr("class", "legend")
			.attr("transform", (d, i) => `translate(0, ${i * 20})`);

		legend
			.append("rect")
			.attr("x", 450)
			.attr("width", 18)
			.attr("height", 18)
			.style("fill", (data) => data.color);

		legend
			.append("text")
			.attr("x", 472)
			.attr("y", 9)
			.attr("dy", ".35em")
			.text((data) => data.type_name);
	}
</script>

<div class="flex-1 flex m-4 mt-0 no-underline rounded-lg p-4 bg-slate-50">
	<div class="flex-1">
		<div id="line-chart" class="border border-slate-300 rounded-md m-2" />
		<div id="bar-chart" class="border border-slate-300 rounded-md m-2" />
	</div>
	<div class="flex-1">
		<div id="network" class="border border-slate-300 rounded-md m-2" />
	</div>
</div>
