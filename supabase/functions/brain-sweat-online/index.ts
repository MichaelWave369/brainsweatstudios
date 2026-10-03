// The deployment packager places the shared, tested source alongside this file.
import { createOnlineHandler } from './server.ts';
import { RestOnlineStore } from './store.ts';
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const url=Deno.env.get('SUPABASE_URL');
if(!secret||!url)throw new Error('Online storage configuration is missing.');
// Platform JWT checking is disabled because the handler authenticates every
// POST with a random 256-bit device credential, stored only as a SHA-256 hash.
// Membership, host permissions, capacity, rate limits, and CAS are enforced there.
Deno.serve(createOnlineHandler(new RestOnlineStore(url,secret),{
  origins:['https://larrinamsalva.github.io'],pepper:secret,
}));
