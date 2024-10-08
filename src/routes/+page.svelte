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
		/*{ id: 'experience', label: 'Experience' },*/
		{ id: 'projects', label: 'Projects' },
		{ id: 'contact', label: 'Contact' }
	];
</script>

<svelte:head>
	<title>Hanz Felix's Portfolio</title>
	<meta name="description" content="Portfolio website of Hanz Felix" />
</svelte:head>
<Header {sections} />
<main class="border-x-8 border-gray-700 text-base *:min-h-screen *:py-12 md:text-lg">
	<Hello id={sections[0].id} />
	<About id={sections[1].id} />
	<!--Experience /-->
	<Projects id={sections[2].id} />
	<Contact id={sections[3].id} />
</main>
<Footer />
