<script>
	/** @type {{details: any}} */
	let { details } = $props();
</script>

<div class="mb-4 w-full border-4 border-gray-700 bg-gray-50">
	<div
		class="aspect-video w-full bg-[url('https://placehold.co/400x300/CCCCCC/777777')] bg-cover bg-center object-cover"
	>
		<div class="z-20 float-end box-border flex h-6">
			<div
				class="aspect-square h-full bg-linear-to-bl from-gray-700 from-50% to-transparent to-50%"
			></div>
			<span
				class=" whitespace-nowrap border-gray-700 bg-gray-700 pr-1 text-sm uppercase text-gray-300"
			>
				Personal Project {details}
			</span>
		</div>
	</div>
	<h3 class="bg-gray-700 px-4 py-1 text-xl text-gray-50">Lorem Ipsum</h3>
	<div class="p-4">
		<div></div>
		<p class="text-stone-700">
			Lorem ipsum dolor sit amet consectetur adipisicing elit.
			{#if (details + 1) % 5 == 0}
				Adipisci vero itaque amet deleniti ipsum aspernatur repellat ducimus omnis temporibus, quasi
				vitae quisquam harum at sint neque labore ex sequi necessitatibus?
			{/if}
		</p>
	</div>
</div>
