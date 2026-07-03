import { render, fireEvent, waitFor } from "@testing-library/react-native";
import Login from "../app/(auth)/login";
import { AuthProvider } from "@/providers/AuthProvider";

// Mock secure storage so we can assert the dev-bypass session write.
jest.mock("@/utils/storage", () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
  STORAGE_KEYS: {
    authToken: "jobops.auth.token",
    authUser: "jobops.auth.user",
  },
}));

import { setItem, STORAGE_KEYS } from "@/utils/storage";

describe("login flow", () => {
  it("signs in via dev-bypass and persists a session token", async () => {
    const { getByPlaceholderText, getByText } = render(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    );

    // Supabase is unconfigured in tests → dev-mode hint is shown.
    await waitFor(() => getByText(/Dev mode: Supabase not configured/i));

    fireEvent.changeText(getByPlaceholderText("you@example.com"), "user@example.com");
    fireEvent.changeText(getByPlaceholderText("••••••••"), "hunter2");
    fireEvent.press(getByText("Sign in"));

    await waitFor(() =>
      expect(setItem).toHaveBeenCalledWith(STORAGE_KEYS.authToken, "dev-token"),
    );
  });

  it("blocks submit and surfaces an error when email is empty", async () => {
    const { getByText, findByText } = render(
      <AuthProvider>
        <Login />
      </AuthProvider>,
    );

    fireEvent.press(getByText("Sign in"));

    expect(await findByText("Enter your email")).toBeTruthy();
  });
});
