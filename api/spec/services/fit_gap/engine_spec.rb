# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:tenant_id) { 1 }

  let(:assessment) do
    Assessment.create!(
      tenant_id: tenant_id,
      created_by: 1,
      name: 'Frontend Engineer Assessment',
      time_limit_min: 45,
      language: 'en'
    )
  end

  let(:session) do
    Session.create!(
      tenant_id: tenant_id,
      assessment: assessment,
      candidate_name: 'Candidate A',
      status: 'ended',
      end_reason: 'all_covered'
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
      tenant_id: tenant_id,
      created_by: 1,
      role_title: 'Mid-Level Frontend Engineer',
      culture_dimensions: 'Async-first, high ownership',
      competency_expectations: 'Delivers features end-to-end'
    )
  end

  let(:mock_gemini) do
    instance_double(
      Gemini::HttpClient,
      generate_content: {
        'culture_narrative' => 'Strong alignment with high-ownership engineering culture.',
        'overall_narrative' => 'Recommended to proceed to technical panel interview.'
      }
    )
  end

  describe '#call' do
    before do
      # 1. Overridden skill: AI L2 -> Override L4 vs Required L3 => exceed (+1), case-insensitive skill_id
      react_skill = PortfolioSkill.create!(
        portfolio: portfolio,
        skill_id: 'sk-eng-001',
        skill_label: 'React / Frontend Development Core',
        ai_level: 2,
        ai_confidence: 'high',
        evidence: ['Demonstrated custom hook patterns'],
        competency_summary: 'Solid component patterns.'
      )
      AssessorOverride.create!(
        portfolio_skill: react_skill,
        ai_level: 2,
        override_level: 4,
        assessor_notes: 'Demonstrated strong architecture thinking.',
        overridden_by: 1
      )

      # 2. Matched skill: AI L3 vs Required L3 => match (0)
      PortfolioSkill.create!(
        portfolio: portfolio,
        skill_id: 'SK-ENG-009',
        skill_label: 'TypeScript & Type Systems',
        ai_level: 3,
        ai_confidence: 'medium',
        evidence: ['Used generics accurately'],
        competency_summary: 'Types features consistently.'
      )

      # 3. Gap skill: AI L1 vs Required L3 => gap (-2)
      PortfolioSkill.create!(
        portfolio: portfolio,
        skill_id: nil,
        skill_label: 'Testing & Quality Assurance',
        ai_level: 1,
        ai_confidence: 'low',
        evidence: ['Limited unit test exposure'],
        competency_summary: 'Needs guidance on test strategy.'
      )

      VacancySkill.create!(vacancy: vacancy, skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core', expected_level: 3)
      VacancySkill.create!(vacancy: vacancy, skill_id: 'SK-ENG-009', skill_label: 'TypeScript & Type Systems', expected_level: 3)
      VacancySkill.create!(vacancy: vacancy, skill_id: nil, skill_label: 'Testing & Quality Assurance', expected_level: 3)
      VacancySkill.create!(vacancy: vacancy, skill_id: 'SK-ENG-003', skill_label: 'System Design & Architecture', expected_level: 2)
    end

    it 'computes match, exceed, gap, not_assessed, and serializes seam fields accurately' do
      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini).call

      expect(report).to be_persisted
      expect(report.culture_narrative).to include('high-ownership')
      expect(report.overall_narrative).to include('Recommended to proceed')

      by_label = report.skill_comparisons.index_by { |c| c['skill_label'] }

      # Overridden skill (case-insensitive skill_id match sk-eng-001 == SK-ENG-001)
      react = by_label['React / Frontend Development Core']
      expect(react['required_level']).to eq(3)
      expect(react['expected_level']).to eq(3)
      expect(react['ai_level']).to eq(2)
      expect(react['candidate_level']).to eq(4)
      expect(react['is_override']).to be(true)
      expect(react['assessor_notes']).to eq('Demonstrated strong architecture thinking.')
      expect(react['result']).to eq('exceed')
      expect(react['delta']).to eq(1)

      # Matched skill
      ts = by_label['TypeScript & Type Systems']
      expect(ts['required_level']).to eq(3)
      expect(ts['candidate_level']).to eq(3)
      expect(ts['is_override']).to be(false)
      expect(ts['result']).to eq('match')
      expect(ts['delta']).to eq(0)

      # Gap skill
      qa = by_label['Testing & Quality Assurance']
      expect(qa['required_level']).to eq(3)
      expect(qa['candidate_level']).to eq(1)
      expect(qa['result']).to eq('gap')
      expect(qa['delta']).to eq(-2)

      # Unassessed skill
      sys = by_label['System Design & Architecture']
      expect(sys['required_level']).to eq(2)
      expect(sys['candidate_level']).to be_nil
      expect(sys['is_override']).to be(false)
      expect(sys['result']).to eq('not_assessed')
      expect(sys['delta']).to be_nil
    end

    it 'falls back gracefully when the Gemini narrative call raises an error' do
      failing_gemini = instance_double(Gemini::HttpClient)
      allow(failing_gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError.new('Timeout'))

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: failing_gemini).call

      expect(report).to be_persisted
      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to eq(
        'Candidate shows 1 skill matches, 1 exceeds, and 1 gaps against role requirements.'
      )
    end

    it 'handles a vacancy with zero configured skills without validation failure' do
      empty_vacancy = Vacancy.create!(
        tenant_id: tenant_id,
        created_by: 1,
        role_title: 'Generalist Role'
      )

      report = described_class.new(portfolio: portfolio, vacancy: empty_vacancy, gemini_client: mock_gemini).call

      expect(report).to be_persisted
      expect(report.skill_comparisons).to eq([])
    end
  end
end
