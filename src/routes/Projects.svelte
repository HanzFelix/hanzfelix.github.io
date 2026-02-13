<script lang="ts">
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import { onMount } from 'svelte';
	import type { ProjectDetails } from '$lib/types';
	import type { HTMLAttributes } from 'svelte/elements';

	let { ...rest }: HTMLAttributes<HTMLDivElement> = $props();

	interface GridInfo {
		_el: HTMLElement;
		gap: number;
		items: HTMLElement[];
		ncol: number;
		mod: number;
	}

	let grids: GridInfo[] = [];
	let masonryElement: HTMLElement = $state();

	async function refreshLayout() {
		grids.forEach(async (grid) => {
			/* get the post relayout number of columns */
			let ncol = getComputedStyle(grid._el).gridTemplateColumns.split(' ').length;

			grid.items.forEach((c) => {
				let new_h = c.getBoundingClientRect().height;

				if (new_h !== +c.dataset.h) {
					c.dataset.h = `${new_h}`;
					grid.mod++;
				}
			});

			/* if the number of columns has changed */
			if (grid.ncol !== ncol || grid.mod) {
				/* update number of columns */
				grid.ncol = ncol;
				/* revert to initial positioning, no margin */
				grid.items.forEach((c) => c.style.removeProperty('margin-top'));
				/* if we have more than one column */
				if (grid.ncol > 1) {
					// add delay to calculate after card transitions
					await new Promise((resolve) => setTimeout(resolve, 300));
					grid.items.slice(ncol).forEach((c, i) => {
						let prev_fin =
								grid.items[i].getBoundingClientRect().bottom /* bottom edge of item above */,
							curr_ini = c.getBoundingClientRect().top; /* top edge of current item */
						c.style.marginTop = `${Math.min(grid.gap + prev_fin - curr_ini, 0)}px`;
					});
				}

				grid.mod = 0;
			}
		});
	}

	async function calcGrid(_masonryArr: HTMLElement[]) {
		if (_masonryArr.length && getComputedStyle(_masonryArr[0]).gridTemplateRows !== 'masonry') {
			grids = _masonryArr.map((grid) => {
				return {
					_el: grid,
					gap: parseFloat(getComputedStyle(grid).rowGap),
					items: [...grid.childNodes].filter(
						(c): c is HTMLElement =>
							c.nodeType === 1 &&
							c instanceof HTMLElement &&
							+getComputedStyle(c).gridColumnEnd !== -1
					),
					ncol: 0,
					mod: 0
				};
			});
			refreshLayout(); /* initial load */
		}
	}

	function debounce(func: () => void, delay: number) {
		let timeoutId: number;
		return function () {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => func.apply(this), delay);
		};
	}

	let projects: ProjectDetails[] = $state([]);
	onMount(async () => {
		try {
			const response = await fetch(
				'https://second-haft.tumulakhanz.workers.dev/api/portfolio/projects'
			);
			if (response.ok) {
				const result = await response.json();
				projects = result.data.projects;
			}
		} catch (error) {
			console.log(error);
		}
	});

	$effect(() => {
		if (projects) {
			// update if items are changed
			calcGrid([masonryElement]);
		}
	});
</script>

<svelte:window onresize={debounce(refreshLayout, 300)} />
<section class="flex" {...rest}>
	<div class="container mx-auto px-4 py-12">
		<h2 class="text-4xl px-4">Projects</h2>
		<div
			bind:this={masonryElement}
			class="mt-12 grid grid-cols-1 gap-2 sm:gap-4 *:self-start sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
			style="grid-template-rows: masonry;"
		>
			{#each projects as project (project.name)}
				<ProjectCard details={project} />
			{/each}
		</div>
	</div>
</section>
