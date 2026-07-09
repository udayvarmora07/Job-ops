import { render } from "@testing-library/react-native";
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

  it("groups applications into stages", async () => {
    const { findByText, getByText } = render(
      <QueryProvider>
        <Applications />
      </QueryProvider>,
    );

    await findByText("Senior SRE");

    // The Interview app surfaces under its stage header (date-independent),
    // and both roles remain visible in the grouped list.
    expect(getByText(/Interview & offers/)).toBeTruthy();
    expect(getByText("DevOps Engineer")).toBeTruthy();
  });
});
