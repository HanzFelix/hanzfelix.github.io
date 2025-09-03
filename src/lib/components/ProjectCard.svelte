<script lang="ts">
	let { details: project } = $props();
</script>

<div
	class="mb-4 w-full border-4 border-gray-700 bg-gray-50 shadow-lg hover:shadow-gray-500 transition-all duration-200 hover:-translate-y-2 group"
>
	<div
		style={`background-image: url('${project.image_url}');`}
		class="aspect-video w-full bg-cover bg-center object-cover"
	>
		<div class="z-20 float-end box-border flex h-6">
			<div
				class="aspect-square h-full bg-linear-to-bl from-gray-700 from-50% to-transparent to-50%"
			></div>
			<span
				class=" border-gray-700 bg-gray-700 pr-1 text-sm whitespace-nowrap text-gray-300 uppercase"
			>
				{project.type}
			</span>
		</div>
	</div>
	<h3 class="transition-colors bg-gray-700 px-4 py-1 text-xl text-gray-100">
		{project.name}
	</h3>
	<div class="flex flex-col gap-2 p-4">
		<!--Tags-->
		<ul class="flex gap-2 text-sm text-gray-100 *:rounded-sm *:bg-gray-500 *:px-2 flex-wrap">
			{#each project.tags as { icon, name }}
				<li>{name}</li>
			{/each}
		</ul>
		<!--Description-->
		<p class="text-slate-700">
			{project.description}
		</p>
		<!--Links-->
		<ul
			class="text-sm text-gray-800 flex gap-2 *:not-first:before:content-['•'] *:not-first:before:mr-2 *:*:underline"
		>
			{#each project.links as { name, url }}
				<li>
					<a href={url}>{name}</a>
				</li>
			{/each}
		</ul>
	</div>
</div>
