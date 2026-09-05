import { describe, it, expect } from 'vitest';
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addAuditLog: vi.fn(),
  countDocuments: vi.fn().mockResolvedValue(1),
  findById: vi.fn(),
  findOne: vi.fn().mockResolvedValue({ _id: { toString: () => "bootstrap-admin" } }),
  findUsers: vi.fn(),
  jwtSign: vi.fn(() => "test-token"),
  jwtVerify: vi.fn(),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("./models/User", () => ({
  User: {
    countDocuments: mocks.countDocuments,
    find: mocks.findUsers,
    findById: mocks.findById,
    findOne: mocks.findOne,
  },
}));

vi.mock("./mongodb", () => ({
  connectToMongoDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./auditLog", () => ({ addAuditLog: mocks.addAuditLog }));
vi.mock("./emailNotification", () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));
vi.mock("jsonwebtoken", () => ({
  default: { sign: mocks.jwtSign, verify: mocks.jwtVerify },
}));

import { mongoAuthRouter } from "./mongoAuthRouter";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));

const adminUser = {
  _id: { toString: () => "admin-id" },
  comparePassword: vi.fn(),
  email: "admin@example.test",
  fullName: "Test Administrator",
  role: "admin",
  save: vi.fn().mockResolvedValue(undefined),
  username: "admin",
};

const createCaller = (user: unknown, authorization?: string) =>
  mongoAuthRouter.createCaller({
    adminToken: null,
    req: {
      headers: authorization ? { authorization } : {},
      ip: "127.0.0.1",
    },
    res: {},
    user,
  } as any);

describe("Mongo authentication router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findOne.mockResolvedValue(adminUser);
    mocks.findById.mockResolvedValue(adminUser);
    mocks.findUsers.mockReturnValue({ sort: vi.fn().mockResolvedValue([adminUser]) });
    mocks.sendPasswordResetEmail.mockResolvedValue(true);
    adminUser.comparePassword.mockResolvedValue(true);
    adminUser.save.mockResolvedValue(undefined);
    mocks.jwtSign.mockReturnValue("test-token");
    mocks.jwtVerify.mockReturnValue({ id: "admin-id", role: "admin", username: "admin" });
  });

  it("authenticates a valid Mongo-backed user and returns a signed token", async () => {
    const result = await createCaller(null).login({
      password: "test-password",
      username: "ADMIN",
    });

    expect(mocks.findOne).toHaveBeenCalledWith({ username: "admin" });
    expect(adminUser.comparePassword).toHaveBeenCalledWith("test-password");
    expect(mocks.jwtSign).toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      token: "test-token",
      user: { id: "admin-id", role: "admin", username: "admin" },
    });
  });

  it("rejects an unknown user and a wrong password without issuing a token", async () => {
    mocks.findOne.mockResolvedValueOnce(null);
    await expect(
      createCaller(null).login({ password: "test-password", username: "missing" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.jwtSign).not.toHaveBeenCalled();

    adminUser.comparePassword.mockResolvedValueOnce(false);
    await expect(
      createCaller(null).login({ password: "wrong-password", username: "admin" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.jwtSign).not.toHaveBeenCalled();
  });

  it("resolves the current user only from a verified bearer token", async () => {
    await expect(createCaller(null).me()).resolves.toBeNull();

    const result = await createCaller(null, "Bearer test-token").me();
    expect(mocks.jwtVerify).toHaveBeenCalled();
    expect(mocks.findById).toHaveBeenCalledWith("admin-id");
    expect(result).toMatchObject({ id: "admin-id", role: "admin", username: "admin" });
  });

  it("keeps user-directory reads behind the actual verified-admin boundary", async () => {
    await expect(createCaller(null).listUsers()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(createCaller({ _id: "user-id", role: "user" }).listUsers()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(createCaller({ _id: "admin-id", role: "admin" }).listUsers()).resolves.toHaveLength(1);
  });

  it("uses the complete reset-email contract and rejects missing, mismatched, and expired tokens", async () => {
    const caller = createCaller(null);
    await expect(
      caller.requestPasswordReset({ email: "admin@example.test" })
    ).resolves.toEqual({ success: true });

    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(
      "admin@example.test",
      "admin",
      expect.any(String),
      expect.any(Date)
    );

    const [, , issuedToken, expiresAt] = mocks.sendPasswordResetEmail.mock.calls[0] as [
      string,
      string,
      string,
      Date,
    ];

    await expect(
      caller.resetPassword({ newPassword: "test-password", token: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.resetPassword({ newPassword: "test-password" } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.resetPassword({ newPassword: "test-password", token: null } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.resetPassword({ newPassword: "test-password", token: randomBytes(32).toString("hex") })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    vi.useFakeTimers();
    vi.setSystemTime(new Date(expiresAt.getTime() + 1));
    await expect(
      caller.resetPassword({ newPassword: "test-password", token: issuedToken })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    vi.useRealTimers();
  });

  it("revokes a reset token when email delivery fails while preserving the generic response", async () => {
    const caller = createCaller(null);
    mocks.sendPasswordResetEmail.mockResolvedValueOnce(false);

    await expect(
      caller.requestPasswordReset({ email: "admin@example.test" })
    ).resolves.toEqual({ success: true });

    const [, , undeliveredToken] = mocks.sendPasswordResetEmail.mock.calls[0] as [
      string,
      string,
      string,
      Date,
    ];
    await expect(
      caller.resetPassword({ newPassword: "test-password", token: undeliveredToken })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("mounts the Mongo-backed auth router and never the quarantined legacy router", () => {
    const rootRouter = fs.readFileSync(path.join(serverDirectory, "routers.ts"), "utf8");

    expect(rootRouter).toContain('import { mongoAuthRouter } from "./mongoAuthRouter"');
    expect(rootRouter).toContain("simpleAuth: mongoAuthRouter");
    expect(rootRouter).not.toContain('from "./simpleAuthRouter"');
  });
});
