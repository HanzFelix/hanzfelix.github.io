<script>
	import { onMount } from 'svelte';
	import Header from './Header.svelte';
	import Hello from './Hello.svelte';
	import About from './About.svelte';
	import Experience from './Experience.svelte';
	import Projects from './Projects.svelte';
	import Contact from './Contact.svelte';
	import Footer from './Footer.svelte';
	const sections = {
		hello: 'HANZ',
		about: 'About',
		experience: 'Experience',
		projects: 'Projects',
		contact: 'Contact'
	};
</script>

<svelte:head>
	<title>Hanz Felix's Portfolio</title>
	<meta name="description" content="Portfolio website of Hanz Felix" />
</svelte:head>
<Header {sections} />
<main class="border-x-8 border-gray-700 text-base *:min-h-screen *:py-12 md:text-lg">
	<Hello id="hello" />
	<About id="about" />
	<Experience id="experience" />
	<Projects id="projects" />
	<Contact id="contact" />
</main>
<Footer />
