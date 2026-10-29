# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:assessment) do
    Assessment.create!(
      tenant_id: 1,
      created_by: 1,
      name: 'Frontend Engineer Assessment',
      time_limit_min: 45
    )
  end

  let(:session) do
    Session.create!(
      tenant_id: 1,
      assessment: assessment,
      candidate_name: 'Budi Santoso',
      status: 'ended',
      duration_seconds: 625
    )
  end

  let(:portfolio) do
    Portfolio.create!(
      session: session,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end

  let(:vacancy) do
    Vacancy.create!(
      tenant_id: 1,
      created_by: 1,
      role_title: 'Frontend Developer'
    )
  end

  it 'generates a valid PDF binary even with assessor overrides and non-Windows-1252 Unicode characters' do
    skill = PortfolioSkill.create!(
      portfolio: portfolio,
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development Core',
      ai_level: 2,
      ai_confidence: 'high',
      evidence: ['Candidate said: state → render ✓ 🚀'],
      competency_summary: 'Strong grasp of hooks → memoization.'
    )

    AssessorOverride.create!(
      portfolio_skill: skill,
      ai_level: 2,
      override_level: 3,
      assessor_notes: 'Upgraded L2 → L3 ✓',
      overridden_by: 1
    )

    FitGapReport.create!(
      portfolio: portfolio,
      vacancy: vacancy,
      skill_comparisons: [
        {
          'skill_label' => 'React / Frontend Development Core',
          'required_level' => 3,
          'expected_level' => 3,
          'candidate_level' => 3,
          'is_override' => true,
          'result' => 'match',
          'delta' => 0
        }
      ],
      culture_narrative: 'Good fit → proactive communicator.',
      overall_narrative: 'Recommended ✓'
    )

    pdf_bytes = described_class.new(portfolio: portfolio, vacancy: vacancy).call

    expect(pdf_bytes).to be_present
    expect(pdf_bytes[0, 4]).to eq('%PDF')
  end
end
