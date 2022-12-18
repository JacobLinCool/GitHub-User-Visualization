<script lang="ts">
	import type { User } from "$lib/types";

	export let user: User;
</script>

<a
	class="flex items-center m-4 no-underline rounded-lg p-4 bg-slate-100"
	href={user.url}
	target="_blank"
	rel="noreferrer"
>
	<div class="mr-4">
		<img src={user.avatar} alt={user.name} class="w-20 h-20 rounded-[42.5%] object-cover" />
	</div>
	<div class="flex-1">
		<h1 class="text-3xl m-0 text-slate-800">{user.name}</h1>
		<p class="text-xl m-0 text-slate-500">{user.company || ""}</p>
	</div>
</a>
