<script lang="ts">
	import type { Repos, Commits, Issues } from "$lib/types";
	import * as d3 from "d3";

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

	// create the dataset to show a x-axis with the dates, y-axis with the number of language related commits and a line for each language, month by month

	$: console.log("selected_commits", selected_commits);
	$: console.log("selected_issues", selected_issues);
</script>

<div
	style="flex: 1; display: flex; flex-direction: column; margin: 0 1rem 1rem 1rem; text-decoration: none; border-radius: 0.5rem; padding: 1rem; background: #f8f8f8"
>
	<div
		style="display: flex; flex-direction: column; height: 100px; overflow: auto; border: gray solid 1px; border-radius: 0.4rem"
	>
		{#each repositories as repo}
			<label style="display: flex; align-items: center; margin: 0.5rem 0">
				<input type="checkbox" bind:checked={repo.selected} style="margin-right: 0.5rem" />
				{repo.name}
			</label>
		{/each}
	</div>
	<ul>
		<li>{selected_repos.size} repos</li>
		<li>{selected_commits.length} commits</li>
		<li>{selected_issues.length} issues</li>
	</ul>
</div>
