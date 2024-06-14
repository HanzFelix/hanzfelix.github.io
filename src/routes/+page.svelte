<script>
	import { onMount } from 'svelte';
	import Header from './Header.svelte';
	import Hello from './Hello.svelte';
	import About from './About.svelte';
	import Experience from './Experience.svelte';
	import Projects from './Projects.svelte';
	import Contact from './Contact.svelte';
	import Footer from './Footer.svelte';
	const sections = [
		{ id: 'hello', label: 'HANZ' },
		{ id: 'about', label: 'About' },
		{ id: 'projects', label: 'Projects' },
		{ id: 'contact', label: 'Contact' }
	];
</script>

<svelte:head>
	<title>Hanz Felix's Portfolio</title>
	<meta name="description" content="Portfolio website of Hanz Felix" />
</svelte:head>
<Header {sections} />
<main class="*:min-h-screen md:text-lg text-base *:py-12 border-gray-700 border-x-8">
	<Hello id={sections[0].id} />
	<About id={sections[1].id} />
	<!--Experience /-->
	<Projects id={sections[2].id} />
	<Contact id={sections[3].id} />
</main>
<Footer />
<!--div class="">
	<section class="h-screen flex flex-col justify-center items-center">
		<div class="">Landing goes here</div>
	</section>
	<section class="min-h-screen">
		<h1 class="bg-black text-white w-full sticky top-12 text-4xl">Section 1</h1>
		<div class="">Hello</div>
	</section>
	<section>
		<h1 class="bg-red-500 text-white w-full sticky top-12 text-4xl">Section 2</h1>
		<div class="h-screen">Hello</div>
		<h1 class="bg-black text-white w-full sticky top-12 text-4xl" id="section-projects">
			Projects
		</h1>
		<div
			class="min-h-screen columns-xs *:w-full gap-4 *:mb-4 container mx-auto mt-12 px-4 *:inline-block"
		>
			<div class="bg-red-500 aspect-video">1</div>
			<div class="bg-blue-500 aspect-square">2</div>
			<div class="bg-red-500 aspect-video">3</div>
			<div class="bg-blue-500 aspect-square">4</div>
			<div class="bg-red-500 aspect-video">5</div>
			<div class="bg-blue-500 aspect-square">6</div>
			<div class="bg-red-500 aspect-video">7</div>
			<div class="bg-blue-500 aspect-square">8</div>
			<div class="bg-red-500 aspect-video">9</div>
		</div>
	</section>
</div-->
