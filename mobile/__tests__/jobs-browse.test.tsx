import { render, fireEvent, waitFor } from "@testing-library/react-native";
import Jobs from "../app/(tabs)/jobs";
import { QueryProvider } from "@/providers/QueryProvider";
import type { Job } from "@/types";

jest.mock("@/api/jobs");
import { fetchJobs } from "@/api/jobs";

const SAMPLE: Job[] = [
  {
    url: "https://boards.greenhouse.io/google/sre",
    company: "Google",
    role: "Senior Site Reliability Engineer",
    portal: "greenhouse",
    location: "Remote",
    firstSeen: "2026-06-30",
    inPipeline: false,
    processed: false,
    source: "scan",
    expRequired: null,
    expMinYears: null,
  },
  {
    url: "https://jobs.netflix.com/devops",
    company: "Netflix",
    role: "DevOps Engineer",
    portal: "lever",
    location: "Los Angeles",
    firstSeen: "2026-07-01",
    inPipeline: true,
    processed: false,
    source: "both",
    expRequired: null,
    expMinYears: null,
  },
];

describe("job browser", () => {
  beforeEach(() => {
    (fetchJobs as jest.Mock).mockResolvedValue(SAMPLE);
  });

  it("loads jobs from the API and renders cards", async () => {
    const { findByText, getByText } = render(
      <QueryProvider>
        <Jobs />
      </QueryProvider>,
    );

    expect(await findByText("Senior Site Reliability Engineer")).toBeTruthy();
    expect(getByText("DevOps Engineer")).toBeTruthy();
  });

  it("filters the deck when a filter chip is tapped", async () => {
    const { findByText, getByText, queryByText } = render(
      <QueryProvider>
        <Jobs />
      </QueryProvider>,
    );

    await findByText("Senior Site Reliability Engineer");

    // Only Netflix is inPipeline in the sample; the "In pipeline" chip should
    // drop the Google card from the deck.
    fireEvent.press(getByText("In pipeline"));

    await waitFor(() => {
      expect(queryByText("Senior Site Reliability Engineer")).toBeNull();
      expect(queryByText("DevOps Engineer")).toBeTruthy();
    });
  });
});
