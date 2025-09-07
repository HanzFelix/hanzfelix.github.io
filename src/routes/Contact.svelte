<script>
	/** @type {{id: any}} */
	let { id } = $props();
	//sendgrid? mailgun? staticforms.xyz? serverless email functions
</script>

<section class=" flex items-center bg-gray-100" {id}>
	<div class="container mx-auto px-8">
		<h2 class="text-4xl">How about a message?</h2>
		<p class="mt-2">Just fill up the form below and I'll try to respond as soon as possible.</p>
	</div>
	<form
		action="https://formsubmit.co/0d458019871697df7a87afd79836c74e"
		method="POST"
		class="mx-auto mt-12 w-full flex flex-col gap-4 sm:shadow-md shadow-gray-400 border-gray-500 bg-gray-200 py-4 px-8 sm:px-4 sm:max-w-md sm:rounded-lg sm:border-2"
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
				class="rounded-sm border-2 border-gray-500 bg-gray-50 px-2"
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
				class="rounded-sm border-2 border-gray-500 bg-gray-50 px-2"
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
				class="rounded-sm border-2 border-gray-500 bg-gray-50 px-2 py-1"
				placeholder="I'd like..."
				required
			></textarea>
		</div>
		<button
			type="submit"
			class="self-center rounded-md border-2 border-black bg-linear-0 from-blue-400 to-blue-50 px-6 pt-1 pb-0.5"
			>Send</button
		>
	</form>
</section>
