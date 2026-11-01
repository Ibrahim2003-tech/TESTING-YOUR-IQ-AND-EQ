import assert from "node:assert/strict";
import test from "node:test";
import { getSession } from "./authController.js";

test("returns an empty session when no authentication cookie is present", async () => {
  const response = {
    payload: null,
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await getSession({ cookies: {} }, response);

  assert.deepEqual(response.payload, { user: null });
});
