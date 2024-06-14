<script>
	export let details;
</script>

<div class="border-gray-700 w-full mb-4 border-2 bg-gray-50">
	<div
		class="aspect-video object-cover w-full bg-[url('https://placehold.co/400x300/CCCCCC/777777')] bg-center bg-cover"
	>
		<span class="relative z-20 top-0 right-0">Academic Project {details}</span>
	</div>
	<h3 class="bg-gray-700 text-gray-50 text-2xl px-4 py-1">Lorem Ipsum</h3>
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
