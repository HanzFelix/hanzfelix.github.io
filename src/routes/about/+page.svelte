<script>
	import { onMount } from 'svelte';

	let activeLink = $state('home');

	const sections = [
		{ id: 'home', label: 'Home' },
		{ id: 'about', label: 'About' },
		{ id: 'services', label: 'Services' },
		{ id: 'contact', label: 'Contact' }
	];

	// https://dev.to/areeburrub/change-nav-link-s-style-as-you-scroll-4p62

	function handleScroll() {
		sections.forEach((section) => {
			const element = document.getElementById(section.id);
			const sectionTop = element?.offsetTop ?? 0;
			if (window.scrollY >= sectionTop - 600) {
				activeLink = section.id;
			}
		});
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll);

		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	});
</script>

<svelte:head>
	<title>About</title>
	<meta name="description" content="About this app" />
</svelte:head>

<nav class="mt-12 sticky top-12 bg-blue-200 h-12 flex justify-center mb-8">
	{#each sections as section}
		<a href={`#${section.id}`} class:active={activeLink === section.id}>
			{section.label}
		</a>
	{/each}
</nav>
{#each sections as sect}
	<section id={sect.id} class="h-screen scroll-mt-32">
		<h2>{sect.label}</h2>
		<p>This is the {sect.label} section.</p>
	</section>
{/each}

<style>
	a {
		color: #333;
		text-decoration: none;
		padding: 0.5rem 1rem;
		margin: 0 0.5rem;
		transition: color 0.3s ease;
	}

	a.active {
		color: #007bff;
		font-weight: bold;
	}
</style>
