import { building } from '$app/environment';

if (!building) {
	import('$lib/server/expiry').then(({ startExpiryCleanup }) => {
		startExpiryCleanup();
	});
}
