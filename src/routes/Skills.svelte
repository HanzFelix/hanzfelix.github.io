<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { ...rest }: HTMLAttributes<HTMLDivElement> = $props();

	const skills = [
		{
			name: 'Frontend',
			languages: [
				{
					name: 'javascript',
					image:
						'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg',
					frameworks: [
						{
							name: 'Vue',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vuejs/vuejs-original.svg'
						},
						{
							name: 'React',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg'
						},
						{
							name: 'Next.js',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg'
						},
						{
							name: 'Svelte',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/svelte/svelte-original.svg'
						},
						{
							name: 'Astro',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/astro/astro-original.svg'
						}
					]
				},
				{
					name: 'CSS',
					image: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg',
					frameworks: [
						{
							name: 'Bootstrap',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bootstrap/bootstrap-original.svg'
						},
						{
							name: 'TailwindCSS',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg'
						}
					]
				}
			]
		},
		{
			name: 'Backend',
			languages: [
				{
					name: 'javascript',
					image:
						'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg',
					frameworks: [
						{
							name: 'nodejs',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg'
						},
						{
							name: 'Next.js',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg'
						}
					]
				},
				{
					name: 'PHP',
					image: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/php/php-original.svg'
				},
				{
					name: 'Rust',
					image: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg'
				}
			]
		},
		{
			name: 'Database',
			languages: [
				{
					name: 'PostgreSQL',
					image:
						'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg',
					frameworks: [
						{
							name: 'Supabase',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/supabase/supabase-original.svg'
						}
					]
				},
				{
					name: 'NoSQL',
					image:
						'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/graphql/graphql-plain.svg',
					frameworks: [
						{
							name: 'Firebase',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/firebase/firebase-original.svg'
						},
						{
							name: 'MongoDB',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg'
						}
					]
				},
				{
					name: 'MySQL',
					image:
						'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg'
				}
			]
		},
		{
			name: 'DevOps',
			languages: [
				{
					name: 'Github',
					image:
						'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg',
					frameworks: [
						{
							name: 'Github Actions',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/githubactions/githubactions-original.svg'
						}
					]
				},
				{
					name: 'Cloudflare',
					image:
						'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cloudflare/cloudflare-original.svg',
					frameworks: [
						{
							name: 'Cloudflare Workers',
							image:
								'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cloudflareworkers/cloudflareworkers-original.svg'
						}
					]
				},
				{
					name: 'Vercel',
					image:
						'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vercel/vercel-original.svg'
				}
			]
		}
	];
</script>

<section class="flex items-center relative" {...rest}>
	<div class="container mx-auto px-4 py-12">
		<h2 class="text-4xl px-4">Core Skills</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 mt-12 gap-8 sm:gap-4">
			{#each skills as skill (skill.name)}
				<div>
					<h3 class="bg-cyan-800/25 px-4 mb-4 text-xl">{skill.name}</h3>
					<div class="inline-flex gap-2 flex-wrap px-4">
						{#each skill.languages as language (language.name)}
							<div class="bg-gray-100 flex rounded-xl">
								<div class="p-2 bg-cyan-700 rounded-md relative group">
									<img
										src={language.image}
										height="36"
										width="36"
										alt={language.name}
										class="drop-shadow-sm drop-shadow-cyan-100"
									/>
									<span
										class="group-hover:visible invisible absolute top-16 left-1/2 -translate-x-1/2 bg-slate-600 text-gray-200 px-2 rounded-md"
										>{language.name}</span
									>
								</div>
								<div class="not-empty:p-2 flex gap-4">
									{#each language.frameworks as framework (framework.name)}
										<div class="relative group">
											<img src={framework.image} height="36" width="36" alt={framework.name} />

											<span
												class="group-hover:visible invisible absolute top-14 left-1/2 -translate-x-1/2 bg-slate-600 text-gray-200 px-2 rounded-md"
												>{framework.name}</span
											>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>
