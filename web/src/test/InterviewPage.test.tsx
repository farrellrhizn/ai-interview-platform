import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";

// Mock child audio hooks and hardware check to isolate page-level state routing
vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: vi.fn(),
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: () => ({
    connect: vi.fn(),
    send: vi.fn(),
    sendJson: vi.fn(),
    disconnect: vi.fn(),
    connectionState: "connected",
  }),
}));

vi.mock("@/components/HardwareCheck", () => ({
  default: () => <div data-testid="hardware-check">Hardware Check Component</div>,
}));

describe("InterviewPage Candidate States", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders honest 'Invalid or Expired Interview Link' when candidate token returns 404", async () => {
    vi.spyOn(sessionsApi, "getCandidateInfo").mockRejectedValue({
      response: { status: 404 },
    });

    render(
      <MemoryRouter initialEntries={["/interview/invalid-token-xyz"]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Invalid or Expired Interview Link/i)
      ).toBeInTheDocument();
    });

    // Ensure it NEVER shows false "Interview Complete"
    expect(screen.queryByText(/Interview Complete/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/We couldn't find an interview invitation matching this URL/i)
    ).toBeInTheDocument();
  });

  it("renders 'Session Interrupted' when session has failed or encounters server error", async () => {
    vi.spyOn(sessionsApi, "getCandidateInfo").mockResolvedValue({
      data: {
        session_id: 99,
        role_title: "Frontend Engineer",
        time_limit_min: 45,
        session_status: "failed",
        end_reason: "error",
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/interview/crashed-token-123"]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Session Interrupted/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Interview Complete/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/This interview session encountered a technical interruption earlier/i)
    ).toBeInTheDocument();
  });

  it("renders 'Interview Complete' only when session actually completed normally", async () => {
    vi.spyOn(sessionsApi, "getCandidateInfo").mockResolvedValue({
      data: {
        session_id: 88,
        role_title: "React Developer",
        time_limit_min: 30,
        session_status: "ended",
        end_reason: "all_covered",
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/interview/completed-token-456"]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Interview Complete")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Thank you. The interview has been recorded/i)
    ).toBeInTheDocument();
  });

  it("renders candidate privacy consent card on valid active session before hardware check", async () => {
    vi.spyOn(sessionsApi, "getCandidateInfo").mockResolvedValue({
      data: {
        session_id: 77,
        role_title: "Junior Frontend Engineer",
        time_limit_min: 30,
        session_status: "pending",
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/interview/valid-pending-token"]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Privacy & AI Voice Assessment Notice/i })
      ).toBeInTheDocument();
    });

    // Hardware check is NOT rendered until consent is explicitly accepted
    expect(screen.queryByTestId("hardware-check")).not.toBeInTheDocument();
  });
});
