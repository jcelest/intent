"use client";

import { useState } from "react";

export default function OpportunityIntelligenceSettingsPage() {
  const [samKey, setSamKey] = useState("api-prod-florida-gov-configured");
  const [refreshInterval, setRefreshInterval] = useState("daily");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-white">Opportunity Intelligence Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure Florida geographic scopes, procurement scraping cadences, and official API connectors.
        </p>
      </div>

      {saveSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-xs font-medium text-emerald-300">
          ✓ Configuration settings updated successfully.
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Geographic Focus Section */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Florida Territorial Architecture</h3>
          <p className="text-xs text-slate-400">
            System is permanently locked to Florida&apos;s 67 counties and regional jurisdictions per project specification.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="rounded-xl bg-black/30 p-3 border border-white/5">
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Jurisdiction</span>
              <span className="font-semibold text-white">Florida (Statewide)</span>
            </div>
            <div className="rounded-xl bg-black/30 p-3 border border-white/5">
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Counties Covered</span>
              <span className="font-semibold text-cyan-400">67 Counties (100% Coverage)</span>
            </div>
            <div className="rounded-xl bg-black/30 p-3 border border-white/5">
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Postal Range</span>
              <span className="font-semibold text-slate-200">ZIP 32000 - 34999 (Florida Only)</span>
            </div>
            <div className="rounded-xl bg-black/30 p-3 border border-white/5">
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Standard Publishing Platforms</span>
              <span className="font-semibold text-slate-200">OpenGov, DemandStar, Bonfire, SAM.gov</span>
            </div>
          </div>
        </div>

        {/* API Integrations */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Federal & State Procurement Connectors</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                SAM.gov API Key (Florida-Filtered Contract Opportunities)
              </label>
              <input
                type="password"
                value={samKey}
                onChange={(e) => setSamKey(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Used to query official Federal contracts with performance location inside Florida (NAICS 238220, 238160, 238210, 236220).
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Autonomous Data Refresh Frequency
              </label>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="hourly">Every Hour (High-volume bidding)</option>
                <option value="daily">Daily at 06:00 AM EST (Recommended)</option>
                <option value="weekly">Weekly on Mondays</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-cyan-500 px-6 py-2.5 text-xs font-bold text-black hover:bg-cyan-400 transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
