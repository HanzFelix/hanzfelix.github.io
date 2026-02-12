interface ProjectTag {
	icon: string;
	name: string;
}

interface ProjectLink {
	name: string;
	url: string;
}

export interface ProjectDetails {
	_id: string;
	name: string;
	description: string;
	type: string;
	image_url: string;
	tags: ProjectTag[];
	links: ProjectLink[];
}
