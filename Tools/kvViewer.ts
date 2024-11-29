const kv = await Deno.openKv();

// List all entries
for await (const entry of kv.list({ prefix: [] })) {
  console.log("Key:", entry.key);
  console.log("Value:", entry.value);
  console.log("---");
}
