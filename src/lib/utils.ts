export function formatDate(inputDate: string | null) {
	if (!inputDate) return '';
	const date = new Date(inputDate);
	return date.toLocaleDateString('default', {
		month: 'long',
		year: 'numeric'
	});
}
