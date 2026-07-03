import { render, fireEvent, waitFor } from "@testing-library/react-native";
import Applications from "../app/(tabs)/applications";
import { QueryProvider } from "@/providers/QueryProvider";
import type { Application } from "@/types";

jest.mock("@/api/applications");
import { fetchApplications } from "@/api/applications";

const SAMPLE: Application[] = [
  {
    num: "001",
    date: "2026-06-20",
    company: "Google",
    role: "Senior SRE",
    score: "4.5/5",
    scoreNum: 4.5,
    status: "Interview",
    pdf: true,
    reportNum: "001",
    notes: "",
  },
  {
    num: "002",
    date: "2026-06-22",
    company: "Netflix",
    role: "DevOps Engineer",
    score: "4.2/5",
    scoreNum: 4.2,
    status: "Applied",
    pdf: true,
    reportNum: "002",
    notes: "",
  },
];

describe("application tracker filtering", () => {
  beforeEach(() => {
    (fetchApplications as jest.Mock).mockResolvedValue(SAMPLE);
  });

  it("renders all applications by default", async () => {
    const { findByText, getByText } = render(
      <QueryProvider>
        <Applications />
      </QueryProvider>,
    );

    expect(await findByText("Senior SRE")).toBeTruthy();
    expect(getByText("DevOps Engineer")).toBeTruthy();
  });

  it("filters to a single status when a chip is tapped", async () => {
    const { findByText, getByTestId, queryByText } = render(
      <QueryProvider>
        <Applications />
      </QueryProvider>,
    );

    await findByText("Senior SRE");

    // Tap the "Interview" filter chip (testID avoids the status badge clash).
    fireEvent.press(getByTestId("filter-Interview"));

    await waitFor(() => {
      expect(queryByText("Senior SRE")).toBeTruthy(); // Interview app stays
      expect(queryByText("DevOps Engineer")).toBeNull(); // Applied app filtered out
    });
  });
});
