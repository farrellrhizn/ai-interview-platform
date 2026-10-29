import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidateConsentCard from "@/components/interview/CandidateConsentCard";

describe("CandidateConsentCard (UU PDP Informed Consent)", () => {
  it("renders privacy notice and keeps continue button disabled until explicit consent checkbox is checked", async () => {
    const handleAccepted = vi.fn();
    const user = userEvent.setup();

    render(
      <CandidateConsentCard
        roleTitle="Senior Frontend Engineer"
        timeLimitMin={45}
        onConsentAccepted={handleAccepted}
      />
    );

    // Verify key UU PDP clauses are presented to candidate
    expect(
      screen.getByRole("heading", { name: /Privacy & AI Voice Assessment Notice/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/UU PDP No\. 27\/2022/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Real-Time Voice & Transcript Processing/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/AI-Assisted Evaluation with Human Review/i)
    ).toBeInTheDocument();

    // Button should initially be disabled
    const continueBtn = screen.getByRole("button", {
      name: /Agree & Continue to Device Check/i,
    });
    expect(continueBtn).toBeDisabled();

    // Check the explicit consent checkbox
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(continueBtn).toBeEnabled();

    // Clicking enabled button fires callback
    await user.click(continueBtn);
    expect(handleAccepted).toHaveBeenCalledTimes(1);
  });
});
