<script lang="ts">
	import { formatDate } from '$lib/utils';
	import { onMount } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let { ...rest }: HTMLAttributes<HTMLDivElement> = $props();

	let cv = $state({ work_experience: [], education: [] });

	onMount(async () => {
		try {
			const response_exp = await fetch(
				'https://second-haft.tumulakhanz.workers.dev/api/portfolio/experience'
			);
			if (response_exp.ok) {
				const result_exp = await response_exp.json();
				cv.work_experience = result_exp.data.work_experience;
			}

			const response_edu = await fetch(
				'https://second-haft.tumulakhanz.workers.dev/api/portfolio/education'
			);
			if (response_edu.ok) {
				const result_edu = await response_edu.json();
				cv.education = result_edu.data.education;
			}
		} catch (error) {
			console.log(error);
		}
	});
</script>

<section {...rest} class="flex items-center">
	<div class="container mx-auto px-8 py-12">
		<h2 class="text-4xl">Curriclum Vitae</h2>
		<div class="relative">
			{#if cv.work_experience.length + cv.education.length > 0}
				<div
					class="flex flex-col gap-8 before:left-1 md:before:left-1/2 before:rounded-sm mt-12 before:absolute before:w-1 before:top-0 before:bg-cyan-700 before:h-full"
				>
					{#each Object.keys(cv) as section, i (i)}
						{#if cv[section].length > 0}
							<div class="md:text-center">
								<h3
									class="inline text-2xl -mx-1 md:mx-0 px-7 md:px-5 py-1 bg-cyan-700 rounded-sm text-gray-100 relative"
								>
									{['Work Experience', 'Education'][i]}
								</h3>
							</div>
						{/if}

						{#each cv[section] as entry (entry._id)}
							<div
								class="flex flex-col items-start px-6 md:w-1/2 md:odd:text-right md:odd:ml-1 md:even:ml-auto md:odd:items-end before:bg-cyan-700 before:rounded-xs before:w-3 before:h-3 before:absolute md:before:left-1/2 md:before:-mx-1 before:left-0 before:mt-1"
							>
								<p class="text-sm bg-slate-600 rounded-sm text-gray-300 px-2 -mx-2">
									{formatDate(entry.date_start)} - {formatDate(entry.date_end) || 'Present'}
								</p>
								<h2 class="text-xl text-gray-800 md:text-2xl mt-2 font-bold text-balance">
									{entry.role || entry.degree}
								</h2>
								<p class="text-sm text-gray-500 text-balance">
									{entry.company || entry.institution}
								</p>
								<p class="md:max-w-md md:text-justify mt-4 text-slate-700">
									{entry.description}
								</p>
							</div>
						{/each}
						<br class="first:hidden last:hidden" />
					{/each}
				</div>
			{/if}
		</div>
	</div>
</section>
