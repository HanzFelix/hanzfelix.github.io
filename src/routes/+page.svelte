<script>
	import Header from './Header.svelte';
	import Hello from './Hello.svelte';
	import About from './About.svelte';
	import Experience from './Experience.svelte';
	import Projects from './Projects.svelte';
	import Contact from './Contact.svelte';
	import Footer from './Footer.svelte';
	import Skills from './Skills.svelte';
	const sections = {
		hello: 'HANZ',
		/*about: 'About',*/
		skills: 'Skills',
		/*experience: 'CV',*/
		projects: 'Projects',
		contact: 'Contact'
	};
</script>

<svelte:head>
	<title>Hanz Felix's Portfolio</title>
	<meta name="description" content="Portfolio website of Hanz Felix" />
</svelte:head>
<Header {sections} />
<main
	class="border-x-8 border-gray-700 text-gray-800 text-base *:first:min-h-svh *:not-last:not-first:min-h-screen *:not-last:py-12 md:text-lg *:even:bg-gray-100 *:odd:bg-gray-200"
>
	<Hello id="hello" />
	<About id="about" />
	<Skills id="skills" />
	<Experience id="experience" />
	<Projects id="projects" />
	<Contact id="contact" />
	<Footer />
</main>
