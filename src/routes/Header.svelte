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
	class="fixed z-50 top-0 h-12 flex w-screen border-t-8 border-gray-700 justify-stretch md:justify-end right-0 *:bg-gray-700"
>
	<div
		class="hidden md:inline-block aspect-square h-full"
		style="clip-path: polygon(0% 0%, 100% 0%, 100% 100%);"
	></div>
	<div class="flex items-center h-full justify-around w-full md:w-auto">
		{#each sections as section}
			<a
				href={`#${section.id}`}
				class=" first:font-black py-2 px-4 {activeLink === section.id
					? 'text-purple-400 underline underline-offset-2'
					: 'text-gray-200'}"
			>
				{section.label}
			</a>
		{/each}
	</div>
	<div class="md:px-4"></div>
</nav>
