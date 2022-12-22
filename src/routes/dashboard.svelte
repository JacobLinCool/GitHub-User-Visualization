<script lang="ts">
	import type { Repos, Commits, Issues, Issue } from "$lib/types";
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
		.map(([repo, issues]) => issues.map((issue) => ({ ...issue, repo })))
		.flat()
		.filter(
			(issue) =>
				issue.participants.length > 1 && issue.created >= time_start && issue.created <= time_end,
		)
		.sort((a, b) => d3.ascending(a.created, b.created));

	$: {
		console.log({ selected_repos, time_start, time_end });
		console.log(selected_commits, selected_issues);
		update_line_chart();
		update_bar_chart();
		update_network_graph();
	}

	onMount(async () => {
		await init_line_chart();
		await update_line_chart();
		await init_network_graph();
		await init_bar_chart();
		await update_bar_chart();
		await update_network_graph();
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
	let disabled_lang = new Set<string>();
	$: {
		console.log("disabled lang", disabled_lang);
		update_line_chart();
		update_bar_chart();
	}
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
			line_chart_updating = false;
			return;
		}

		const time_tag = `update line chart ${new Date().toTimeString()}`;
		console.time(time_tag);

		const { languages, months } = await calc.langs(selected_commits);

		const sorted_langs = Array.from(languages.entries())
			.sort(([, a], [, b]) => d3.descending(d3.sum(a), d3.sum(b)))
			.slice(0, 10);

		for (const lang of languages.keys()) {
			if (!sorted_langs.some(([l]) => l === lang)) {
				languages.delete(lang);
			}
		}

		const element = document.querySelector("#line-chart");

		const margin = { top: 20, right: 20, bottom: 30, left: 50 };
		const width = (element?.clientWidth || 960) - margin.left - margin.right;
		const height = 400 - margin.top - margin.bottom;

		const chart = d3.select(element).select("svg").select("g");

		const x = d3
			.scaleTime()
			.domain(d3.extent(selected_commits, (commit) => commit.date) as [Date, Date])
			.range([0, width])
			.nice();

		const y = d3
			.scaleLinear()
			.domain([
				0,
				d3.max(
					languages.entries(),
					([lang, data]) => (disabled_lang.has(lang) ? 0 : d3.max(data)) as number,
				) as number,
			])
			.range([height, 0]);

		chart
			.select<SVGGElement>("#x-axis")
			.attr("transform", `translate(0, ${height})`)
			.transition()
			.call(d3.axisBottom(x));

		chart.select<SVGGElement>("#y-axis").transition().call(d3.axisLeft(y));

		chart.selectAll(".legend").remove();

		const font_scale = sorted_langs.length > 14 ? 14 / sorted_langs.length : 1;

		const legend = chart
			.selectAll(".legend")
			.data(sorted_langs)
			.join("g")
			.attr("class", "legend")
			.attr("transform", (d, i) => `translate(0, ${i * 20 * font_scale})`)
			.style("cursor", "pointer")
			.style("opacity", ([lang]) => (disabled_lang.has(lang) ? 0.4 : 1))
			.on("click", (evt, [lang]) => {
				if (disabled_lang.has(lang)) {
					disabled_lang.delete(lang);
				} else {
					disabled_lang.add(lang);
				}

				disabled_lang = disabled_lang;
			});

		legend
			.append("rect")
			.attr("x", 10)
			.attr("width", 18 * font_scale)
			.attr("height", 18 * font_scale)
			.style("fill", ([lang]) => language_color[lang] || "#ccc");

		legend
			.append("text")
			.attr("x", 32)
			.attr("y", 9)
			.attr("dy", "0.3rem")
			.style("font-size", `${font_scale}rem`)
			.text(([lang]) => lang);

		chart.selectAll(".line").remove();
		chart
			.selectAll(".line")
			.data([...languages.entries()].filter(([lang]) => !disabled_lang.has(lang)))
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

		const zoom = d3
			.zoom<any, any>()
			.scaleExtent([1, time_units / 7])
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

				if (new_start < time_range[0]) {
					new_start = time_range[0];
				}
				if (new_start > new Date(time_range[1].getTime() - 0.5 * time_unit)) {
					new_start = new Date(time_range[1].getTime() - 0.5 * time_unit);
				}

				let new_end = new Date(new_start.getTime() + (time_units * time_unit) / evt.transform.k);

				console.log({ new_start, new_end, time_start, time_end });
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

		if (!selected_commits) {
			bar_chart_updating = false;
			return;
		}

		const time_tag = `update bar chart ${new Date().toTimeString()}`;
		console.time(time_tag);

		const type_total = await calc.types({ commits: selected_commits, disabled: disabled_lang });

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

		chart
			.selectAll("rect")
			.data(type_total)
			.join("rect")
			.attr("x", (data, i) => x_pos(i) + 45)
			.attr("y", (data) => y(data.count))
			.attr("width", 30)
			.attr("height", (data) => height - y(data.count))
			.style("fill", (data) => data.color)
			.style("transition", "all 0.3s ease-in-out");

		chart
			.select<SVGGElement>("#x-axis")
			.attr("transform", `translate(0, ${height})`)
			.call(d3.axisBottom(x_name));

		chart.select<SVGGElement>("#y-axis").transition().call(d3.axisLeft(y));

		chart.selectAll(".legend").remove();

		const legend = chart
			.selectAll(".legend")
			.data(type_total)
			.join("g")
			.attr("class", "legend")
			.attr("transform", (d, i) => `translate(0, ${i * 20})`);

		legend
			.append("rect")
			.attr("x", width - 80)
			.attr("width", 18)
			.attr("height", 18)
			.style("fill", (data) => data.color);

		legend
			.append("text")
			.attr("x", width - 56)
			.attr("y", 9)
			.attr("dy", ".35em")
			.text((data) => data.type_name);

		console.timeEnd(time_tag);

		bar_chart_updating = false;
	}

	let network_threshold = 0;
	$: {
		console.log("network threshold changed", network_threshold);
		update_network_graph();
	}
	async function init_network_graph() {
		const time_tag = `init network ${new Date().toTimeString()}`;
		console.time(time_tag);

		const element = document.querySelector("#network");

		const margin = { top: 20, right: 20, bottom: 30, left: 50 };
		const width = (element?.clientWidth || 800) - margin.left - margin.right;
		const height = (element?.clientHeight || 800) - margin.top - margin.bottom;

		const svg = d3
			.select(element)
			.append("svg")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.style("overflow", "hidden");

		const graph = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

		const zoom = d3
			.zoom<any, any>()
			.scaleExtent([0, 1])
			.on("zoom", (event) => {
				network_threshold = event.transform.k;
			});

		graph
			.append("rect")
			.attr("id", "threshold")
			.attr("width", width)
			.attr("height", height)
			.attr("fill", "none")
			.attr("pointer-events", "all")
			.call(zoom);

		graph.append("g").attr("id", "links");
		graph.append("g").attr("id", "nodes").attr("stroke", "#fff").attr("stroke-width", 1.5);

		graph.append("text").attr("id", "threshold-text");

		console.timeEnd(time_tag);
	}

	let network_graph_updating = false;
	let network_graph_final_state = 0;
	const position_cache = new Map<string, { x: number; y: number }>();
	async function update_network_graph(state = network_graph_final_state + 1) {
		if (state > network_graph_final_state) {
			network_graph_final_state = state;
		}
		if (network_graph_updating) {
			setTimeout(() => {
				if (network_graph_final_state === state) {
					update_network_graph(state);
				}
			}, 200);
			return;
		}
		network_graph_updating = true;

		if (!selected_issues || selected_issues.length < 1) {
			network_graph_updating = false;
			return;
		}

		const time_tag = `update network ${new Date().toTimeString()}`;
		console.time(time_tag);

		const element = document.querySelector("#network");

		const margin = { top: 20, right: 20, bottom: 30, left: 50 };
		const width = (element?.clientWidth || 800) - margin.left - margin.right;
		const height = (element?.clientHeight || 800) - margin.top - margin.bottom;

		const svg = d3.select(element).select("svg");
		const graph = svg.select("g");

		const { self, max, nodes, links } = await calc.graph({
			issues: selected_issues,
			threshold: network_threshold,
		});

		console.log("network", nodes, links);

		if (nodes.length < 2) {
			network_graph_updating = false;
			return;
		}

		nodes.forEach((node) => {
			if (position_cache.has(node.name)) {
				node.x = position_cache.get(node.name)?.x || 0;
				node.y = position_cache.get(node.name)?.y || 0;
			}
		});

		const link = graph
			.select<SVGGElement>("#links")
			.selectAll("line")
			.data(links)
			.join("line")
			.attr("stroke-width", (d) => 2.5 + (d.value / max) * 5)
			.attr("stroke", (d) => (d.source === self.name ? "purple" : "gray"))
			.attr("stroke-opacity", (d) => 0.3 + (d.value / max) * 0.5);

		link.append("title").text((d) => `${d.value} issue${d.value > 1 ? "s" : ""}`);

		graph.select<SVGGElement>("#nodes").selectAll("g").remove();
		const node = graph.select<SVGGElement>("#nodes").selectAll("g").data(nodes).join("g");
		node
			.append("circle")
			.attr("r", (d) => 5 + Math.min(1, d.count / max) * 10)
			.attr("fill", (d) => {
				if (d.name === self.name) {
					return "purple";
				}
				if (d.type === "user") {
					return "royalblue";
				}
				if (d.type === "repo" && selected_repos.has(d.name)) {
					return "red";
				}
				return "black";
			});
		node
			.append("text")
			.text((d) => d.name)
			.attr("font-size", 10)
			.attr("dx", (d) => 5 + Math.min(1, d.count / max) * 10)
			.attr("dy", 3)
			.style("user-select", "none")
			.style("fill", (d) =>
				d.name === self.name ? "purple" : d.type === "user" ? "royalblue" : "red",
			)
			.style("stroke", "white")
			.style("stroke-width", 0.3)
			.style("cursor", "pointer")
			.on("click", (evt, d) => {
				const url = `https://github.com/${d.name}`;
				console.log("open", url);
				setTimeout(() => {
					const win = window.open("about:blank", "_blank");
					if (win) {
						win.location = url;
					}
				}, 0);
			});
		node.append("title").text((d) => `${d.name} - ${d.count} issue${d.count > 1 ? "s" : ""}`);

		const simulation = d3
			.forceSimulation(nodes as any)
			.force(
				"link",
				d3
					.forceLink(links as any)
					.id((d: any) => d.name)
					.strength(0.2),
			)
			.force(
				"collide",
				d3
					.forceCollide()
					.radius((d: any) => 7 + Math.min(1, d.count / max) * 10)
					.iterations(2),
			)
			.force("charge", d3.forceManyBody().strength(-10))
			.force(
				"radial",
				d3
					.forceRadial(
						(d: any) => (d.name === self.name ? 0 : d.type === "repo" ? 150 : 300),
						width / 2,
						height / 2,
					)
					.strength(5),
			)
			.force("center", d3.forceCenter(width / 2, height / 2));

		function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
			function dragstarted(
				event: d3.D3DragEvent<SVGElement, d3.SimulationNodeDatum, undefined>,
				node: d3.SimulationNodeDatum,
			) {
				if (!event.active) {
					simulation.alphaTarget(0.3).restart();
				}
				node.fx = node.x;
				node.fy = node.y;
			}
			function dragged(
				event: d3.D3DragEvent<SVGElement, d3.SimulationNodeDatum, undefined>,
				node: d3.SimulationNodeDatum,
			) {
				node.fx = event.x;
				node.fy = event.y;
			}
			function dragended(
				event: d3.D3DragEvent<SVGElement, d3.SimulationNodeDatum, undefined>,
				node: d3.SimulationNodeDatum,
			) {
				if (!event.active) {
					simulation.alphaTarget(0);
				}
				node.fx = null;
				node.fy = null;
			}
			// @ts-expect-error
			return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
		}

		node.call(drag(simulation));

		simulation
			.on("tick", () => {
				node.attr("transform", (node) => `translate(${node.x},${node.y})`);
				link
					// @ts-expect-error
					.attr("x1", (d) => d.source.x)
					// @ts-expect-error
					.attr("y1", (d) => d.source.y)
					// @ts-expect-error
					.attr("x2", (d) => d.target.x)
					// @ts-expect-error
					.attr("y2", (d) => d.target.y);

				link.select("title").text((d) => {
					// @ts-expect-error
					return `${d.source.name} - [${d.value} issue${d.value > 1 ? "s" : ""}] - ${
						// @ts-expect-error
						d.target.name
					}`;
				});
			})
			.on("end", () => {
				for (const node of nodes) {
					position_cache.set(node.name, { x: node.x, y: node.y });
				}
			});

		graph
			.select<SVGTextElement>("#threshold-text")
			.text(`Threshold: ${Math.floor(max * network_threshold)} issues`);

		console.timeEnd(time_tag);

		network_graph_updating = false;
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
