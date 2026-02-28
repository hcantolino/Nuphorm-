import { describe, it, expect } from "vitest";
import { useMeasurementTriggerStore } from "./measurementTriggerStore";

describe("measurementTriggerStore", () => {
  it("should initialize with null pending message", () => {
    const store = useMeasurementTriggerStore();
    expect(store.pendingMessage).toBeNull();
  });

  it("should set pending message", () => {
    const store = useMeasurementTriggerStore();
    store.setPendingMessage("create a mean for fold_change");
    expect(store.pendingMessage).toBe("create a mean for fold_change");
  });

  it("should clear pending message when set to null", () => {
    const store = useMeasurementTriggerStore();
    store.setPendingMessage("test message");
    expect(store.pendingMessage).toBe("test message");
    store.setPendingMessage(null);
    expect(store.pendingMessage).toBeNull();
  });

  it("should handle multiple message updates", () => {
    const store = useMeasurementTriggerStore();
    store.setPendingMessage("first message");
    expect(store.pendingMessage).toBe("first message");
    store.setPendingMessage("second message");
    expect(store.pendingMessage).toBe("second message");
  });
});
