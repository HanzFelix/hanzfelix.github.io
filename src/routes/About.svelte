<script>
	/** @type {{id: any}} */
	let { id } = $props();
</script>

<section class=" flex items-center bg-gray-300" {id}>
	<div
		class="container mx-auto flex h-full flex-col-reverse items-stretch gap-8 border-2 border-black px-8 py-12 md:flex-row md:items-center"
	>
		<img
			src="https://placehold.co/300x400/777777/FFF"
			class="aspect-video w-full object-cover md:aspect-auto md:h-auto md:w-72"
			alt=""
			style="clip-path: polygon(10% 0%, 100% 0%, 100% 90%, 90% 100%, 0% 100%, 0% 10%);"
		/>
		<div>
			<h2 class="text-4xl">An aspiring full-stack developer with a sense of simplicity.</h2>
			<ul class="list-disc pl-5 *:my-6">
				<li>
					Lorem, ipsum dolor sit amet consectetur adipisicing elit. Incidunt quos molestias totam et
					expedita temporibus at tempora dignissimos itaque esse inventore tempore natus, sapiente
					quam ipsam placeat. Aliquid, magnam illo!
				</li>
				<li>
					Lorem, ipsum dolor sit amet consectetur adipisicing elit. Incidunt quos molestias totam et
					expedita temporibus at tempora dignissimos itaque esse inventore tempore natus, sapiente
					quam ipsam placeat. Aliquid, magnam illo!
				</li>
				<li>
					Lorem, ipsum dolor sit amet consectetur adipisicing elit. Incidunt quos molestias totam et
					expedita temporibus at tempora dignissimos itaque esse inventore tempore natus, sapiente
					quam ipsam placeat. Aliquid, magnam illo!
				</li>
			</ul>
		</div>
	</div>
</section>
