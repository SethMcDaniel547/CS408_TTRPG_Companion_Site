"use strict";

const { PresenceTracker } = require("../services/PresenceTracker");
const { RoomService } = require("../services/RoomService");
const { validateStatusUpdate } = require("../validation/validators");

describe("PresenceTracker", () => {
  it("counts multiple connections and reports only first/last transitions", () => {
    const presence = new PresenceTracker();
    expect(presence.connect(1, 2)).toBe(true);
    expect(presence.connect(1, 2)).toBe(false);
    expect(presence.isPresent(1, 2)).toBe(true);
    expect(presence.disconnect(1, 2)).toBe(false);
    expect(presence.disconnect(1, 2)).toBe(true);
    expect(presence.isPresent(1, 2)).toBe(false);
    expect(presence.disconnect(1, 2)).toBe(false);
  });
});

describe("validateStatusUpdate", () => {
  it("accepts partial updates and rejects bad values", () => {
    expect(validateStatusUpdate({ statusText: "poisoned" })).toEqual({ statusText: "poisoned" });
    expect(validateStatusUpdate({ grayedOut: true })).toEqual({ grayedOut: true });
    expect(() => validateStatusUpdate({ statusText: "x".repeat(101) })).toThrow();
    expect(() => validateStatusUpdate({ grayedOut: "yes" })).toThrow();
  });
});

describe("RoomService.updateStatus", () => {
  function build(gm = 1) {
    const memberRepo = {
      updateStatus: jest.fn().mockResolvedValue({ status_text: "hi", grayed_out: true }),
    };
    const roomRepo = { findById: jest.fn().mockResolvedValue({ id: 5, gm }) };
    const service = new RoomService(roomRepo, { ...memberRepo, isMember: async () => true }, {}, {}, {});
    service.memberRepo.updateStatus = memberRepo.updateStatus;
    return { service, memberRepo };
  }

  it("saves a player's status", async () => {
    const { service, memberRepo } = build();
    await expect(service.updateStatus(5, 2, { statusText: "hi" })).resolves.toEqual({
      statusText: "hi",
      grayedOut: true,
    });
    expect(memberRepo.updateStatus).toHaveBeenCalledWith(5, 2, { statusText: "hi", grayedOut: null });
  });

  it("does nothing for the GM", async () => {
    const { service, memberRepo } = build(2);
    await expect(service.updateStatus(5, 2, { statusText: "hi" })).resolves.toBeNull();
    expect(memberRepo.updateStatus).not.toHaveBeenCalled();
  });
});
