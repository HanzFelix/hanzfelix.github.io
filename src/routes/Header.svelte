<script>
	import { onMount } from 'svelte';

	/**
	 * @type {any[]}
	 */
	export let sections;
	let activeLink = '';

	function handleScroll() {
		sections.forEach((section) => {
			const element = document.getElementById(section.id);
			const sectionTop = element?.offsetTop ?? 0;
			if (window.scrollY >= sectionTop - 200) {
				activeLink = section.id;
			}
		});
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll);
		handleScroll();

		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	});
</script>

<nav
	class="fixed right-0 top-0 z-50 flex h-12 w-screen justify-stretch border-t-8 border-gray-700 md:justify-end"
>
	<div
		class="hidden aspect-square h-full bg-gradient-to-bl from-gray-700 from-50% to-transparent to-50% md:inline-block"
	></div>
	<div class="flex h-full w-full items-center justify-around bg-gray-700 md:w-auto">
		{#each sections as section}
			<a
				href={`#${section.id}`}
				class=" px-4 py-2 first:font-black {activeLink === section.id
					? 'text-purple-400 underline underline-offset-2'
					: 'text-gray-200'}"
			>
				{section.label}
			</a>
		{/each}
	</div>
	<div class="bg-gray-700 md:px-4"></div>
</nav>
