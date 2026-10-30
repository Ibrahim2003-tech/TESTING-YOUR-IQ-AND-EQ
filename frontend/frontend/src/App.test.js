import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test("renders the student sign-in screen when there is no session", async () => {
  global.fetch = jest.fn().mockImplementation((url) =>
    Promise.resolve({
      ok: url.endsWith("/csrf-token"),
      status: url.endsWith("/csrf-token") ? 200 : 401,
      json: async () =>
        url.endsWith("/csrf-token")
          ? { csrfToken: "test-csrf-token" }
          : { message: "Authentication required" },
    })
  );

  render(<App />);

  expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
});
