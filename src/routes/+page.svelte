<script lang="ts">
	import data from "$lib/data";
	import type { Commits, Issues, Repo, User } from "$lib/types";
	import { onMount } from "svelte";
	import { tweened } from "svelte/motion";
	import UserSection from "./user.svelte";
	import Dashboard from "./dashboard.svelte";

	const progress = tweened(0);

	let user: User;
	let repos: Repo[];
	let commits: Commits;
	let issues: Issues;

	console.log("Version", BUILD_TIMESTAMP);

	async function run() {
		user = await data.user();
		progress.update((n) => n + 10);

		await Promise.all([
			data.repos().then((res) => {
				repos = res;
				progress.update((n) => n + 30);
			}),
			data.commits().then((res) => {
				commits = res;
				progress.update((n) => n + 30);
			}),
			data.issues().then((res) => {
				issues = res;
				progress.update((n) => n + 30);
			}),
		]);

		console.log({ user, repos, commits, issues });
	}

	onMount(async () => {
		await run();
	});
</script>

<div class="flex flex-col h-full w-full">
	<div class="min-h-[2.4rem] flex items-center px-4 bg-slate-800 text-white">
		{user?.name ? `GitHub User Visualization for ${user.name}` : "loading data ..."}
	</div>
	<div class="flex flex-col flex-1">
		{#if user}
			<UserSection {user} />
		{/if}

		{#if repos && commits && issues}
			<Dashboard {repos} {commits} {issues} />
		{:else}
			<h1>{Math.round($progress)}</h1>
		{/if}
	</div>
</div>
