import { building } from '$app/env';

if (!building) {
	import('#lib/server/expiry.js').then(({ startExpiryCleanup }) => {
		startExpiryCleanup();
	});
}
