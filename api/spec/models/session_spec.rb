# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:assessment) do
    Assessment.create!(
      tenant_id: 1,
      created_by: 1,
      name: 'Frontend Assessment',
      time_limit_min: 30
    )
  end

  describe '#invite_url' do
    it 'strips trailing slashes from APP_BASE_URL and builds a valid frontend interview route' do
      session = described_class.create!(tenant_id: 1, assessment: assessment)

      allow(ENV).to receive(:fetch).with('APP_BASE_URL', 'http://localhost:5173')
                                   .and_return('http://localhost:5173/')

      expect(session.invite_url).to eq("http://localhost:5173/interview/#{session.invite_token}")
    end
  end
end
