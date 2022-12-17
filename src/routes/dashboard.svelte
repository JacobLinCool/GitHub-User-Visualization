<script lang="ts">
	import type { Repos, Commits, Issues } from "$lib/types";
	import calc from "$lib/calc";
	import * as d3 from "d3";
	import { onMount } from "svelte";

	export let repos: Repos;
	export let commits: Commits;
	export let issues: Issues;

	const repositories = repos.map((repo) => ({ ...repo, selected: true }));
	const range = [
		Object.values(commits)
			.flat()
			.reduce((min, commit) => d3.min([min, commit.date]) || new Date(0), new Date()),
		Object.values(commits)
			.flat()
			.reduce((max, commit) => d3.max([max, commit.date]) || new Date(), new Date(0)),
	];

	$: selected_repos = new Set(
		repositories.filter((repo) => repo.selected).map((repo) => repo.name),
	);
	$: selected_commits = Object.entries(commits)
		.filter(([repo]) => selected_repos.has(repo))
		.map(([, commits]) => commits)
		.flat()
		.filter((commit) => commit.date >= range[0] && commit.date <= range[1])
		.sort((a, b) => d3.ascending(a.date, b.date));
	$: selected_issues = Object.entries(issues)
		.filter(([repo]) => selected_repos.has(repo))
		.map(([, issues]) => issues)
		.flat()
		.filter((issue) => issue.created >= range[0] && issue.created <= range[1])
		.sort((a, b) => d3.ascending(a.created, b.created));

	$: update();

	onMount(update);

	async function update() {
		console.log("selected_commits", selected_commits);
		console.log("selected_issues", selected_issues);

		if (!selected_commits || !selected_issues) {
			return;
		}

		const time_tag = `update ${Math.random().toString(36).substring(7)}`;
		console.time(time_tag);

		const { languages, months } = await calc.langs(selected_commits);

		const element = document.querySelector("#line-chart");

		const margin = { top: 20, right: 20, bottom: 30, left: 50 };
		const width = (element?.clientWidth || 960) - margin.left - margin.right;
		const height = 500 - margin.top - margin.bottom;

		const svg = d3
			.select(element)
			.append("svg")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.append("g")
			.attr("transform", `translate(${margin.left}, ${margin.top})`);

		const color = d3.scaleOrdinal(d3.schemeCategory10);

		const x = d3
			.scaleTime()
			.domain(d3.extent(selected_commits, (commit) => commit.date) as [Date, Date])
			.range([0, width]);

		const y = d3
			.scaleLinear()
			.domain([0, d3.max(languages.values(), (data) => d3.max(data) as number) as number])
			.range([height, 0]);

		svg.append("g").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x));

		svg.append("g").call(d3.axisLeft(y));

		svg
			.selectAll(".line")
			.data(languages)
			.join("path")
			.attr("fill", "none")
			.attr("stroke", ([lang]) => color(lang))
			.attr("stroke-width", 1.5)
			.attr("d", (data) => {
				console.log(data);
				const iter = months.keys();
				return d3
					.line<number>()
					.x((_, i) => x(new Date(iter.next().value)))
					.y((d) => y(d))(data[1]);
			});

		const brush = d3.brushX().on("brush end", (event) => {
			if (event.selection) {
				const [x0, x1] = event.selection;
				range[0] = x.invert(x0);
				range[1] = x.invert(x1);
			}
		});

		svg.append("g").attr("class", "brush").call(brush);

		console.timeEnd(time_tag);
	}
</script>

<div
	style="flex: 1; display: flex; flex-direction: column; margin: 0 1rem 1rem 1rem; text-decoration: none; border-radius: 0.5rem; padding: 1rem; background: #f8f8f8"
>
	<div id="line-chart" style="border: #ccc solid 1px" />
</div>
