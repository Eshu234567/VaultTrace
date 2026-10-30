import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusChip from '../components/StatusChip';
import ClaimModal from '../components/ClaimModal';

const CATEGORIES = [
  'Electronics',
  'ID / Smart Card',
  'Calculator / Lab Gear',
  'Bottle / Flask',
  'Wallet / Purse',
  'Keys / Keychain',
  'Stationery',
  'Bag / Backpack',
  'Spectacles / Eyewear',
  'Umbrella',
  'Apparel / Jacket',
  'Books / Notes',
  'Jewellery / Watch',
  'Other',
];

const COLOUR_CHIPS = [
  'Black',
  'White / Charcoal',
  'Blue',
  'Teal / Blue',
  'Silver / Grey',
  'Brown',
  'Red',
  'Green',
  'Yellow / Gold',
];

const MATERIAL_CHIPS = [
  'Plastic / Silicone',
  'Stainless Steel',
  'Leather',
  'Metal',
  'Fabric / Canvas',
  'Glass / Acrylic',
  'Paper / Cardstock',
];

const COMMON_TAGS = [
  'airpods',
  'magsafe',
  'calculator',
  'casio',
  '991ex',
  'milton',
  'flask',
  'wallet',
  'lanyard',
  'keys',
  'charger',
  'sticker',
  'engraved',
];

const DRAFT_STORAGE_KEY = 'vaulttrace_lost_report_draft';

export default function ReportLostPage() {
  const { locations, showToast, refreshUnread } = useAuth();
  const navigate = useNavigate();

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [description, setDescription] = useState('');
  const [colour, setColour] = useState('White / Charcoal');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('Pocket / Small');
  const [material, setMaterial] = useState('Plastic / Silicone');
  const [distinctiveMarks, setDistinctiveMarks] = useState('');
  const [selectedTags, setSelectedTags] = useState(['airpods', 'magsafe']);
  const [lastSeenDate, setLastSeenDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lastSeenLocation, setLastSeenLocation] = useState('ISE Department Block - Lab 302');
  const [imageUrl, setImageUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [claimModalTarget, setClaimModalTarget] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.itemName) setItemName(parsed.itemName);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.colour) setColour(parsed.colour);
        if (parsed.brand) setBrand(parsed.brand);
        if (parsed.size) setSize(parsed.size);
        if (parsed.material) setMaterial(parsed.material);
        if (parsed.distinctiveMarks) setDistinctiveMarks(parsed.distinctiveMarks);
        if (Array.isArray(parsed.selectedTags)) setSelectedTags(parsed.selectedTags);
        if (parsed.lastSeenLocation) setLastSeenLocation(parsed.lastSeenLocation);
      } catch (_) {
        // Ignore invalid draft
      }
    }
  }, []);

  const saveDraft = () => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        itemName,
        category,
        description,
        colour,
        brand,
        size,
        material,
        distinctiveMarks,
        selectedTags,
        lastSeenLocation,
      })
    );
    showToast('Report draft saved locally');
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const fillQuickDemoPreset = () => {
    setItemName('Apple AirPods Pro (2nd Gen) Charging Case');
    setCategory('Electronics');
    setBrand('Apple');
    setColour('White / Charcoal');
    setSize('Pocket / Small');
    setMaterial('Plastic / Silicone');
    setSelectedTags(['airpods', 'magsafe', 'sticker']);
    setLastSeenLocation('ISE Department Block - Lab 302');
    setDistinctiveMarks('Mini Batman sticker under the charcoal silicone cover');
    setDescription(
      'Lost my white Apple AirPods Pro 2nd Gen inside a matte charcoal silicone cover during afternoon lab.'
    );
    showToast('Sample report details filled');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest('/lost-reports', {
        method: 'POST',
        body: JSON.stringify({
          itemName,
          category,
          description,
          attributes: {
            colour,
            brand,
            size,
            material,
            distinctiveMarks,
            tags: selectedTags,
          },
          lastSeen: {
            date: lastSeenDate,
            location: lastSeenLocation,
          },
          imageRefs: imageUrl.trim() ? [{ url: imageUrl.trim(), caption: itemName }] : [],
        }),
      });

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setSubmissionResult(res.data);
      await refreshUnread();
      showToast(
        `Lost report ${res.data.report.reportCode} saved with ${res.data.matchesFound} potential match(es)`
      );
    } catch (err) {
      showToast(err.message || 'Failed to submit report', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submissionResult) {
    const { report, candidates = [] } = submissionResult;
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[#2C372F] text-[#F7F6F2] rounded-[28px] p-7 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3E4C42] text-[#DDE6DF] text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Report Saved ({report.reportCode})</span>
            </div>
            <h1 className="text-2xl font-bold">{report.itemName}</h1>
            <p className="text-xs text-[#C8D3C9]">
              The matching service evaluated active vault inventory and identified{' '}
              <strong>{candidates.length}</strong> candidate match(es).
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSubmissionResult(null)}
              className="px-4 py-2.5 rounded-full bg-[#3E4C42] hover:bg-[#4A5A4E] text-[#F7F6F2] text-xs font-semibold transition"
            >
              Report Another
            </button>
            <button
              onClick={() => navigate('/my-activity')}
              className="px-5 py-2.5 rounded-full bg-[#F7F6F2] hover:bg-[#E2E0D6] text-[#1F2621] text-xs font-bold transition"
            >
              Browse Claimable Items
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#1F2621]">
            Candidate Matches ({candidates.length})
          </h2>

          {candidates.length === 0 ? (
            <div className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-[#1F2621]">
                No immediate matches above threshold in current storage.
              </p>
              <p className="text-xs text-[#606861]">
                Your report remains active. When a matching item is registered later, you will receive an automatic notification.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {candidates.map((cand) => {
                const item = cand.foundItem;
                if (!item) return null;
                return (
                  <div
                    key={cand._id}
                    className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-5 flex flex-col md:flex-row gap-5 justify-between"
                  >
                    <div className="flex gap-4">
                      {item.imageRefs?.[0]?.url && (
                        <img
                          src={item.imageRefs[0].url}
                          alt={item.itemName}
                          className="w-28 h-28 rounded-2xl object-cover border border-[#DFDDD4] shrink-0"
                        />
                      )}
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold px-3 py-0.5 rounded-full bg-[#2C372F] text-[#F7F6F2]">
                            {item.itemCode}
                          </span>
                          <span className="text-xs font-semibold px-3 py-0.5 rounded-full bg-[#DDE6DF] text-[#233829] border border-[#B8CBBF]">
                            {cand.score}% Match ({cand.confidenceBand})
                          </span>
                          <StatusChip
                            status={item.status === 'Claim Pending' ? 'Stored' : item.status}
                            size="xs"
                          />
                        </div>

                        <h3 className="font-bold text-[#1F2621] text-base">{item.itemName}</h3>
                        <p className="text-xs text-[#58605A]">{item.description}</p>

                        <div className="pt-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#687069] block mb-1.5">
                            Matched Signals
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {cand.matchedFields?.map((field, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-0.5 rounded-full bg-[#F7F6F2] text-[#2C372F] border border-[#DFDDD4] text-[11px] font-medium"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between items-end border-t md:border-t-0 border-[#DFDDD4] pt-3 md:pt-0 shrink-0">
                      <div className="text-right text-xs text-[#606861] space-y-0.5">
                        <div>Location: <strong className="text-[#1F2621]">{item.foundLocation}</strong></div>
                        <div>Date: {new Date(item.foundAt).toLocaleDateString()}</div>
                      </div>

                      <button
                        onClick={() => setClaimModalTarget(item)}
                        className="mt-3 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Claim This Item</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {claimModalTarget && (
          <ClaimModal
            item={claimModalTarget}
            lostReportId={report._id}
            onClose={() => setClaimModalTarget(null)}
            onSuccess={() => {
              setClaimModalTarget(null);
              navigate('/my-activity');
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2621]">Report a Lost Item</h1>
          <p className="text-xs text-[#606861]">
            Enter item attributes and last known location to search the vault inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fillQuickDemoPreset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#ECEAE3] text-[#2C372F] border border-[#DFDDD4] text-xs font-semibold hover:bg-[#E2E0D6] transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fill Sample Data</span>
          </button>
          <button
            type="button"
            onClick={saveDraft}
            className="px-4 py-2 rounded-full border border-[#D5D3C8] bg-[#FBFBF9] text-[#1F2621] text-xs font-medium hover:bg-[#E2E0D6] transition"
          >
            Save Draft
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 sm:p-8 space-y-6"
      >
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
            1. Item Classification
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                Item Name
              </label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Apple AirPods Pro, Casio Calculator"
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-4 py-2.5 text-sm focus:outline-none focus:border-[#2C372F]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-4 py-2.5 text-sm focus:outline-none focus:border-[#2C372F]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-[#DFDDD4]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
            2. Physical Attributes
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
              Primary Colour
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOUR_CHIPS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColour(c)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                    colour === c
                      ? 'bg-[#2C372F] text-[#F7F6F2] border-[#2C372F]'
                      : 'bg-[#FBFBF9] text-[#4A544C] border-[#D5D3C8] hover:bg-[#E2E0D6]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                Brand (Optional)
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Apple, Casio, Milton"
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                Approximate Size
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
              >
                <option value="Pocket / Small">Pocket / Small</option>
                <option value="Medium / Handheld">Medium / Handheld</option>
                <option value="Large / Carry">Large / Carry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                Material
              </label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
              >
                {MATERIAL_CHIPS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
              Descriptor Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                      active
                        ? 'bg-[#2C372F] text-[#F7F6F2] border-[#2C372F]'
                        : 'bg-[#FBFBF9] text-[#58605A] border-[#D5D3C8] hover:bg-[#E2E0D6]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-[#DFDDD4]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
            3. Location and Date
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                Campus Location Last Seen
              </label>
              <select
                value={lastSeenLocation}
                onChange={(e) => setLastSeenLocation(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
              >
                {locations.map((loc) => (
                  <option key={loc._id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                Approximate Date Last Seen
              </label>
              <input
                type="date"
                required
                value={lastSeenDate}
                onChange={(e) => setLastSeenDate(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-[#DFDDD4]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
            4. Description and Ownership Clues
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
              Detailed Description
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the item and any visible characteristics..."
              className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                Distinctive Marks (Stickers, Initials)
              </label>
              <input
                type="text"
                value={distinctiveMarks}
                onChange={(e) => setDistinctiveMarks(e.target.value)}
                placeholder="e.g., Initials A.S. on back cover"
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                Optional Reference Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#DFDDD4] flex items-center justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition disabled:opacity-50"
          >
            <span>{submitting ? 'Searching Matches...' : 'Submit Lost Report'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
