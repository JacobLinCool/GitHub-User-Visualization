<script lang="ts">
	import type { User } from "$lib/types";

	export let user: User;
</script>

<a
	style="display: flex; align-items: center; margin: 1rem; text-decoration: none; border-radius: 0.5rem; padding: 1rem; background: #f4f4f4"
	href={user.url}
	target="_blank"
	rel="noreferrer"
>
	<div style="margin-right: 1rem">
		<img
			src={user.avatar}
			alt={user.name}
			style="width: 5rem; height: 5rem; border-radius: 42.5%; object-fit: cover"
		/>
	</div>
	<div style="flex: 1">
		<h1 style="font-size: 2rem; margin: 0; color: black">{user.name}</h1>
		<p style="font-size: 1rem; margin: 0; color: gray">{user.company}</p>
	</div>
</a>
