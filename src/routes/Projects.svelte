<script>
	import { run } from 'svelte/legacy';

	/* eslint-disable  @typescript-eslint/no-explicit-any */
	import ProjectCard from '$lib/components/ProjectCard.svelte';

	import TempImage from '$lib/images/portfolio.png';

	import { onMount, onDestroy } from 'svelte';
	/** @type {{id: any}} */
	let { id } = $props();

	let grids = [];
	let masonryElement = $state();

	export const refreshLayout = async () => {
		grids.forEach(async (grid) => {
			/* get the post relayout number of columns */
			let ncol = getComputedStyle(grid._el).gridTemplateColumns.split(' ').length;

			grid.items.forEach((c) => {
				let new_h = c.getBoundingClientRect().height;

				if (new_h !== +c.dataset.h) {
					c.dataset.h = new_h;
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
					grid.items.slice(ncol).forEach((c, i) => {
						let prev_fin =
								grid.items[i].getBoundingClientRect().bottom /* bottom edge of item above */,
							curr_ini = c.getBoundingClientRect().top; /* top edge of current item */

						c.style.marginTop = `${prev_fin + grid.gap - curr_ini}px`;
					});
				}

				grid.mod = 0;
			}
		});
	};

	const calcGrid = async (_masonryArr) => {
		if (_masonryArr.length && getComputedStyle(_masonryArr[0]).gridTemplateRows !== 'masonry') {
			grids = _masonryArr.map((grid) => {
				return {
					_el: grid,
					gap: parseFloat(getComputedStyle(grid).gridRowGap),
					items: [...grid.childNodes].filter(
						(c) => c.nodeType === 1 && +getComputedStyle(c).gridColumnEnd !== -1
					),
					ncol: 0,
					mod: 0
				};
			});
			refreshLayout(); /* initial load */
		}
	};

	let _window;
	onMount(() => {
		_window = window;
		_window.addEventListener('resize', refreshLayout, false); /* on resize */
	});
	onDestroy(() => {
		if (_window) {
			_window.removeEventListener('resize', refreshLayout, false); /* on resize */
		}
	});

	run(() => {
		if (masonryElement) {
			calcGrid([masonryElement]);
		}
	});
</script>

<section class="flex items-center bg-gray-200" {id}>
	<div class="container mx-auto px-8">
		<h2 class="text-4xl">Projects</h2>
		<div
			bind:this={masonryElement}
			class=" mt-12 grid grid-cols-1 gap-4 *:self-start lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
			style="grid-template-rows: masonry;"
		>
			{#each { length: 7 } as _, i}
				<ProjectCard details={i} />
			{/each}
			<img src={TempImage} alt="" srcset="" />
		</div>
	</div>
</section>
