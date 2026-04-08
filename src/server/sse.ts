/**
 * In-memory SSE broadcaster for real-time trip updates.
 * Each connected client holds a ReadableStreamDefaultController.
 * When any mutation on a trip occurs, call broadcastTripUpdate(tripId).
 */
const tripControllers = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();

export function registerTripController(
  tripId: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  if (!tripControllers.has(tripId)) {
    tripControllers.set(tripId, new Set());
  }
  tripControllers.get(tripId)!.add(controller);
}

export function unregisterTripController(
  tripId: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  const set = tripControllers.get(tripId);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) tripControllers.delete(tripId);
}

export function broadcastTripUpdate(tripId: string) {
  const controllers = tripControllers.get(tripId);
  if (!controllers || controllers.size === 0) return;
  const payload = new TextEncoder().encode(`data: {"type":"update"}\n\n`);
  for (const controller of controllers) {
    try {
      controller.enqueue(payload);
    } catch {
      controllers.delete(controller);
    }
  }
}
