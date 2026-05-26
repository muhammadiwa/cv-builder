// @lolos/workers — BullMQ worker bootstrap
// Queues will be registered in later stories (Story 5.3: PDF, Story 4.3: AI)

export function bootstrap(): void {
  console.log("Lolos workers — ready (no queues registered yet)");
}

// Auto-run when invoked directly (e.g. via `tsx src/main.ts`).
// `require.main` is a CommonJS check; under tsx it identifies the entry file.
if (typeof require !== "undefined" && require.main === module) {
  bootstrap();
}
