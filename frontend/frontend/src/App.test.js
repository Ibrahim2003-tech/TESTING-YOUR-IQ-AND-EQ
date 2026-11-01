import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test("renders the student sign-in screen when there is no session", async () => {
  global.fetch = jest.fn().mockImplementation((url) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("/csrf-token")
          ? { csrfToken: "test-csrf-token" }
          : { user: null },
    })
  );

  render(<App />);

  expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(global.fetch).toHaveBeenLastCalledWith(
    expect.stringMatching(/\/api\/auth\/session$/),
    expect.objectContaining({ credentials: "include" })
  );
});
