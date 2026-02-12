<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { ...rest }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<section
	class="flex flex-col justify-center px-4 bg-linear-to-t from-[#e1e9ff] odd:to-gray-200 even:to-gray-100 to-50%"
	{...rest}
>
	<div class="container mx-auto px-4 pt-6">
		<h2 class="text-4xl">How about a message?</h2>
		<p class="mt-2">Just fill up the form below and I'll try to respond as soon as possible.</p>
	</div>
	<form
		action="https://formsubmit.co/0d458019871697df7a87afd79836c74e"
		method="POST"
		class="mx-auto mt-12 w-full flex flex-col gap-4 shadow-md relative shadow-gray-400 border-gray-500 from-gray-300 to-gray-200 bg-linear-0 py-4 px-4 sm:max-w-md rounded-lg border-y-2 border-2"
	>
		<!--input type="hidden" name="_next" value="https://yourdomain.co/thanks.html" /-->
		<input type="hidden" name="_subject" value="Message Delivered from Your Portfolio" />
		<input type="hidden" name="_template" value="box" />
		<!--Email address-->
		<div class="flex flex-col">
			<label for="email">Your email:</label>
			<input
				type="email"
				name="email"
				class="rounded-sm border inset-shadow-xs inset-shadow-gray-400 focus:outline-gray-500 border-gray-500 bg-gray-50 px-2"
				placeholder="example@mail.com"
				required
			/>
		</div>
		<!--Subject-->
		<div class="flex flex-col">
			<label for="subject">Subject:</label>
			<input
				type="text"
				name="subject"
				class="rounded-sm border inset-shadow-xs inset-shadow-gray-400 focus:outline-gray-500 border-gray-500 bg-gray-50 px-2"
				placeholder="What's it about?"
				required
			/>
		</div>
		<!--Message-->
		<div class="flex flex-col">
			<label for="message">Message:</label>
			<textarea
				name="message"
				id="message"
				class="rounded-sm border focus:outline-gray-500 inset-shadow-xs inset-shadow-gray-400 border-gray-500 bg-gray-50 px-2 py-1"
				placeholder="I'd like..."
				required
			></textarea>
		</div>
		<button
			type="submit"
			class="self-center rounded-md border bg-linear-0 transition-colors duration-100 hover:from-blue-300 border-gray-600 active:from-blue-600 cursor-pointer text-gray-800 from-violet-200 to-white active:via-blue-400 active:to-blue-700 active:text-blue-100 px-6 pt-1 pb-0.5"
			>Send</button
		>
	</form>
</section>
