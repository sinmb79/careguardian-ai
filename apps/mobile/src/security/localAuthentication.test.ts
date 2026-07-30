import { describe, expect, test, vi } from "vitest";

const localAuthentication = vi.hoisted(() => ({
  hasHardwareAsync: vi.fn(),
  authenticateAsync: vi.fn()
}));

vi.mock("expo-local-authentication", () => localAuthentication);

import { authenticateForSensitiveAccess } from "./localAuthentication";

describe("device credential authentication", () => {
  test("allows Android PIN fallback even when no biometric hardware is reported", async () => {
    localAuthentication.hasHardwareAsync.mockResolvedValue(false);
    localAuthentication.authenticateAsync.mockResolvedValue({ success: true });

    await expect(authenticateForSensitiveAccess()).resolves.toMatchObject({ authenticated: true });
    expect(localAuthentication.hasHardwareAsync).not.toHaveBeenCalled();
    expect(localAuthentication.authenticateAsync).toHaveBeenCalledWith(expect.objectContaining({
      disableDeviceFallback: false
    }));
  });

  test("fails closed when the device credential prompt is unsuccessful", async () => {
    localAuthentication.authenticateAsync.mockResolvedValue({ success: false });
    await expect(authenticateForSensitiveAccess()).resolves.toMatchObject({ authenticated: false });
  });
});
