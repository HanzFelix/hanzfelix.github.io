<script lang="ts">
	import FileIcon from '$lib/images/FileIcon.svelte';
	import GithubIcon from '$lib/images/GithubIcon.svelte';
	import LinkedinIcon from '$lib/images/LinkedinIcon.svelte';
	import MailIcon from '$lib/images/MailIcon.svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let { ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<section class="flex items-center px-2" {...rest}>
	<div
		class="rounded-4xl container mx-auto flex h-full flex-col-reverse items-stretch inset-shadow-[-5px_-5px_10px_#FFFFFF88,5px_5px_10px_#00000044] justify-between gap-8 px-6 py-8 md:flex-row md:items-center"
	>
		<div class="">
			<h1 class="mb-2 flex flex-wrap text-5xl font-black md:text-6xl select-none">
				<span>I'm&nbsp;</span>
				<div class="flex">
					<span
						class="rotate-180 transform whitespace-nowrap text-center"
						style="writing-mode: horizontal-tb;"
					>
						&nbsp;ZNVH
					</span><span class="transform" style="writing-mode: horizontal-tb;">FELIX</span>
				</div>
			</h1>
			<p>Aspiring software engineer specializing in web development.</p>

			<div
				class="flex justify-center md:justify-start *:rounded-full *:p-4 fill-gray-700 bg-linear-0 mt-4 rounded-full gap-6 *:shadow-[-5px_-5px_10px_#FFFFFF88,5px_5px_10px_#00000044] *:inset-shadow-[5px_5px_10px_-2px_#0000000A] *:hover:fill-cyan-700 *:transition-all *:duration-200 *:active:inset-shadow-[-5px_-5px_10px_#FFFFFF88,5px_5px_10px_#00000044] *:active:shadow-none"
			>
				<a href="https://github.com/HanzFelix" aria-label="mail">
					<GithubIcon class="w-8" />
				</a>
				<a href="https://www.linkedin.com/in/hanzfelixtumulak/">
					<LinkedinIcon class="w-8" />
				</a>
				<a href="mailto:tumulakhanz@gmail.com" aria-label="mail">
					<MailIcon class="w-8" />
				</a>
				<a
					href="https://drive.google.com/file/d/1XDCcrPlaBH3MQZZH1dDFrLOD_pk4u09_/view?usp=drive_link"
					aria-label="resume"
				>
					<FileIcon class="w-8" />
				</a>
			</div>
		</div>
		<img
			src="https://ik.imagekit.io/lugefi/portfolio/self.jpg"
			class="aspect-video rounded-3xl w-full object-cover object-top md:aspect-3/4 md:h-auto md:w-72"
			alt="self"
		/>
	</div>
</section>
