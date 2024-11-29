const kv = await Deno.openKv();

let count = 0;
// List all entries
for await (const entry of kv.list({ prefix: [] })) {
  kv.delete(entry.key);
  count++;
}

console.log(`deleted ${count} keys from the kv sb`);
