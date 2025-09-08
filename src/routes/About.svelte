<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { inview } from 'svelte-inview';
	import { draw } from 'svelte/transition';

	/** @type {{id: any}} */
	let { id } = $props();

	let canvas: HTMLCanvasElement = $state();
	let isRunning = $state(true);
	let isManuallyPaused = $state(false);
	let intervalId = 0;
	let isInView: boolean;
	const rainDrops = [];
	const fontSize = 16;
	let context;
	const katakana =
		'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
	const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const nums = '0123456789';
	const special = '{}&;:><`=~%/*-+';

	const alphabet = katakana + latin + nums + special;

	function pauseCanvas() {
		clearInterval(intervalId);
		isRunning = false;
	}
	function resumeCanvas() {
		if (!isInView) return;
		intervalId = setInterval(drawCanvas, 100);
		isRunning = true;
	}
	function drawCanvas() {
		if (!canvas) {
			clearInterval(intervalId);
			return;
		} /*
			const gradient = context.createLinearGradient(20, 0, 220, 0);

			// Add three color stops
			gradient.addColorStop(0, 'rgba(229, 231, 20, 0.1)');
			gradient.addColorStop(0.5, 'rgba(229, 231, 235, 0.1)');
			gradient.addColorStop(0.2, 'rgba(229, 231, 235, 0.1)');*/

		context.fillStyle = /*gradient; */ 'rgba(231, 231, 235, 0.1)';
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = '#AAD';
		context.font = fontSize + 'px Roboto ';
		context.fontWeight = '800';
		context.textAlign = 'center';

		for (let i = 0; i < rainDrops.length; i++) {
			const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
			context.fillText(text, i * fontSize * 3, rainDrops[i] * fontSize);

			if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
				rainDrops[i] = 0;
			}
			rainDrops[i]++;
			/*if (rainDrops[i] * fontSize < 0 && Math.random() > 0.975) {
				rainDrops[i] = canvas.height / fontSize;
			}
			rainDrops[i]--;*/
		}
	}

	function refreshCanvas() {
		if (!isInView && intervalId) {
			clearInterval(intervalId);
			return;
		}
		if (intervalId) clearInterval(intervalId);
		context = canvas.getContext('2d');

		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		const columns = canvas.width / fontSize / 3;
		for (let x = 0; x < columns; x++) {
			rainDrops[x] = Math.floor(Math.random() * (canvas.height / fontSize));
		}

		resumeCanvas();
	}

	let _window: Window;
	onMount(() => {
		_window = window;
		_window.addEventListener('resize', refreshCanvas, false); /* on resize */
	});
	onDestroy(() => {
		if (_window) {
			_window.removeEventListener('resize', refreshCanvas, false); /* on resize */
		}
	});
	$effect.pre(() => {
		if (canvas) {
			refreshCanvas();
		}
	});
</script>

<section class="flex items-center relative" {id}>
	<div class="absolute top-0 left-0 w-full h-full">
		<canvas
			use:inview={{}}
			oninview_change={({ detail }) => {
				isInView = detail.inView;
				isInView && !isManuallyPaused ? resumeCanvas() : pauseCanvas();
			}}
			class="w-full h-full block transition-all"
			bind:this={canvas}
		></canvas>
	</div>
	<div
		class="container mx-auto flex h-full flex-col-reverse gap-8 z-10 px-2 md:px-8 py-4 md:flex-row"
	>
		<div
			class=" aspect-video backdrop-blur-xs md:mx-0 object-cover md:aspect-auto md:w-sm backdrop-hue-rotate-[220deg] backdrop-saturate-200 backdrop-opacity-70 flex items-center justify-center rounded-2xl"
			style="box-shadow: 
    0 8px 32px rgba(128, 0, 255, 0.1),
    inset 0 1px 0 rgba(0, 0, 0, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1),
    inset 0 0 20px 10px rgba(64, 64, 255, 0.1);"
		>
			<button
				aria-label="about"
				class=""
				onclick={() => {
					isManuallyPaused = !isManuallyPaused;
					if (isRunning) {
						pauseCanvas();
					} else resumeCanvas();
				}}
				><img
					src="https://ik.imagekit.io/lugefi/portfolio/code_folder.png?updatedAt=1757337586677"
					class={`max-w-3xs transition-transform ${!isRunning ? 'saturate-0' : ''}`}
					alt=""
				/></button
			>
		</div>
		<div
			class="backdrop-blur-sm basis-full px-6 py-8 md:px-8 w-full bg-white/20 rounded-2xl border border-gray-50/30 md:pt-12"
			style="box-shadow: 
    0 8px 32px rgba(128, 0, 255, 0.1),
    inset 0 1px 0 rgba(0, 0, 0, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1),
    inset 0 0 20px 10px rgba(128, 0, 255, 0.15);"
		>
			<h2 class="text-4xl">About Me</h2>
			<ul class=" *:my-6">
				<li>
					Aspiring software developer with a strong background in programming languages and
					frameworks of web development, involving HTML5, CSS3, PHP, JavaScript, SQL and NoSQL.
				</li>
				<li>
					Passionate in coding and aiming to expand skills and knowledge in the field, and always
					eager to take on new challenges in creating innovative and impactful technology.
				</li>
			</ul>
		</div>
	</div>
</section>
