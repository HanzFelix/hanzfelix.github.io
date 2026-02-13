<script>
	import { onMount } from 'svelte';

	let { sections } = $props();
	let activeLink = $state('hello');

	function handleScroll() {
		for (const id of Object.keys(sections)) {
			const element = document.getElementById(id);
			const sectionTop = element?.offsetTop ?? 0;
			if (window.scrollY >= sectionTop - 200) {
				activeLink = id;
			}
		}
		/*
		sections.forEach((section) => {
			const element = document.getElementById(section.id);
			const sectionTop = element?.offsetTop ?? 0;
			if (window.scrollY >= sectionTop - 200) {
				activeLink = section.id;
			}
		});*/
	}

	onMount(() => {
		handleScroll();
	});
</script>

<svelte:window onscroll={handleScroll} />
<nav
	class="fixed top-0 right-0 z-50 flex h-12 w-screen justify-stretch border-t-8 border-gray-700 md:justify-end"
>
	<div
		class="hidden aspect-square h-full bg-linear-to-bl from-gray-700 from-50% to-transparent to-50% md:inline-block"
	></div>
	<div class="flex h-full w-full items-center justify-around bg-gray-700 md:w-auto">
		{#each Object.entries(sections) as [key, value] (key)}
			<a
				href={`#${key}`}
				class=" px-4 py-2 first:font-black {activeLink === key
					? 'text-purple-400 underline underline-offset-2'
					: 'text-gray-200'}"
			>
				{value}
			</a>
		{/each}
	</div>
	<div class="bg-gray-700 md:px-4"></div>
</nav>
