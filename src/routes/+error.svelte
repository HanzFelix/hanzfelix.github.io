<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link
		href="https://fonts.googleapis.com/css2?family=Aldrich&family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
		rel="stylesheet"
	/>
</svelte:head>
<div
	class="text-gray-200 font-[Aldrich] flex flex-col justify-between md:justify-end h-svh select-none gap-2"
>
	<br />
	<div class="px-8">
		<h2 style="font-size: clamp(1rem,8vw,6rem); line-height: 80%;">Error</h2>
		<h1
			class="font-[Montserrat] font-bold text-gray-50"
			style="font-size: clamp(4rem,25vw,18rem); line-height: 80%;"
		>
			404
		</h1>
	</div>
	<section class="bg-cyan-700 basis-1/4 text-xl w-full py-4">
		<p class="text-lg px-8">Page not found, for one of the following reasons:</p>
		<div
			class="overflow-hidden flex w-full gap-8 flex-nowrap box-border text-xl mt-2"
			data-direction="right"
		>
			{#each { length: 2 } as _, i}
				<div class="flex shrink-0 h-full min-w-full relative *:m-0 scroll-r2l gap-8">
					<span>it doesn't exist</span>
					<span>page was deleted</span>
					<span>URL was mistyped</span>
					<span>coz why not</span>
					<span>visited too early</span>
					<span>you are a bot</span>
					<span>knew a secret</span>
					<span>knows how to get here</span>
					<span>this looks cool</span>
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	.scroll-r2l {
		animation: scroll-r2l 30s linear infinite;
	}
	@keyframes scroll-r2l {
		from {
			transform: translateX(0);
		}

		to {
			transform: translateX(-102%);
		}
	}
</style>
