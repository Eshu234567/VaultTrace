import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PackagePlus,
  Lock,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import QRTagModal from '../components/QRTagModal';

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

const RETENTION_POLICIES = [
  { value: 'Small / Low-Value', days: 30 },
  { value: 'Standard', days: 90 },
  { value: 'High-Value / Sensitive', days: 180 },
  { value: 'Perishable / Unsafe', days: 2 },
];

export default function ReportFoundPage() {
  const { isAdmin, locations, showToast, refreshUnread } = useAuth();
  const navigate = useNavigate();

  const [quickStationeryBatchMode, setQuickStationeryBatchMode] = useState(false);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [description, setDescription] = useState('');
  const [colour, setColour] = useState('Black');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('Medium / Handheld');
  const [material, setMaterial] = useState('Plastic');
  const [foundLocation, setFoundLocation] = useState('ISE Department Block - Lab 302');
  const [foundDate, setFoundDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [storageLocation, setStorageLocation] = useState('Central Vault Rack A, Bin 01');
  const [retentionClass, setRetentionClass] = useState('Standard');
  const [retentionDays, setRetentionDays] = useState(90);
  const [batchQuantity, setBatchQuantity] = useState(1);
  const [batchLabel, setBatchLabel] = useState('');

  const [serialOrIdFragment, setSerialOrIdFragment] = useState('');
  const [hiddenMarkOrScratch, setHiddenMarkOrScratch] = useState('');
  const [lockedScreenOrContents, setLockedScreenOrContents] = useState('');
  const [verificationPrompt, setVerificationPrompt] = useState(
    'Describe the unique mark, sticker, or serial number fragment on the item.'
  );
  const [imageUrl, setImageUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [createdItemResult, setCreatedItemResult] = useState(null);

  const toggleStationeryBatchMode = (enabled) => {
    setQuickStationeryBatchMode(enabled);
    if (enabled) {
      setCategory('Stationery');
      setRetentionClass('Small / Low-Value');
      setRetentionDays(30);
      setBatchQuantity(15);
      setBatchLabel(`BOX-STAT-2026-${Math.floor(10 + Math.random() * 89)}`);
      setItemName('Stationery Batch: Assorted Gel Pens and Mechanical Pencils');
      setDescription('Bulk intake of unclaimed pens, pencils, and erasers collected after examination session.');
      setColour('Assorted Blue and Black');
      setBrand('Pilot and Pentel');
      setStorageLocation('Central Vault Rack A, Stationery Box 04');
      setHiddenMarkOrScratch('Contains 9 blue gel pens, 4 black pens, 2 mechanical pencils');
    } else {
      setBatchQuantity(1);
      setBatchLabel('');
    }
  };

  const handleRetentionClassChange = (val) => {
    setRetentionClass(val);
    const match = RETENTION_POLICIES.find((p) => p.value === val);
    if (match) setRetentionDays(match.days);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest('/found-items', {
        method: 'POST',
        body: JSON.stringify({
          category,
          itemName,
          description,
          visibleAttributes: {
            colour,
            brand,
            size,
            material,
            tags: itemName
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 2),
          },
          restrictedProof: {
            serialOrIdFragment,
            hiddenMarkOrScratch,
            lockedScreenOrContents,
            verificationPrompt,
          },
          foundAt: foundDate,
          foundLocation,
          storageLocation,
          retentionClass,
          retentionDays: Number(retentionDays),
          isBatchStationery: quickStationeryBatchMode,
          batchQuantity: quickStationeryBatchMode ? Number(batchQuantity) : 1,
          batchLabel,
          imageRefs: imageUrl.trim() ? [{ url: imageUrl.trim(), caption: itemName }] : [],
        }),
      });

      setCreatedItemResult(res.data);
      await refreshUnread();
      showToast(`Found item ${res.data.item.itemCode} recorded`);
    } catch (err) {
      showToast(err.message || 'Failed to register found item', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdItemResult) {
    const { item, matchesTriggered } = createdItemResult;
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#2C372F] text-[#F7F6F2] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <span className="font-mono text-xs font-semibold px-3 py-1 rounded-full bg-[#FBFBF9] border border-[#DFDDD4] text-[#1F2621]">
            {item.itemCode}
          </span>
          <h2 className="text-2xl font-bold text-[#1F2621]">{item.itemName}</h2>
          <p className="text-xs text-[#58605A] max-w-md mx-auto">
            {item.status === 'Pending Verification'
              ? 'Your found item submission has been logged for administrator verification.'
              : `Stored in ${item.storageLocation}. The matching service generated ${matchesTriggered} candidate match(es).`}
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setCreatedItemResult(null)}
              className="px-5 py-2.5 rounded-full border border-[#D5D3C8] bg-[#FBFBF9] text-[#1F2621] text-xs font-semibold hover:bg-[#E2E0D6]"
            >
              Log Another Item
            </button>
            <button
              onClick={() => navigate(isAdmin ? '/admin' : '/')}
              className="px-6 py-2.5 rounded-full bg-[#2C372F] text-[#F7F6F2] text-xs font-semibold hover:bg-[#1F2621]"
            >
              {isAdmin ? 'Open Admin Console' : 'Return to Dashboard'}
            </button>
          </div>
        </div>

        <QRTagModal
          isOpen={true}
          onClose={() => {}}
          title={item.itemName}
          subtitle={item.category}
          code={item.itemCode}
          mode="storage"
          metadata={[
            { label: 'Status', value: item.status },
            { label: 'Found Location', value: item.foundLocation },
            { label: 'Retention Class', value: `${item.retentionClass} (${item.retentionDays} days)` },
            {
              label: 'Review Date',
              value: new Date(item.eligibleForDisposalAt).toLocaleDateString(),
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2621]">
            {isAdmin ? 'Intake Found Item into Vault' : 'Report a Found Item'}
          </h1>
          <p className="text-xs text-[#606861]">
            Record visible details publicly and store ownership verification clues in restricted fields.
          </p>
        </div>

        <button
          type="button"
          onClick={() => toggleStationeryBatchMode(!quickStationeryBatchMode)}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition ${
            quickStationeryBatchMode
              ? 'bg-[#2C372F] text-[#F7F6F2] border-[#2C372F]'
              : 'bg-[#ECEAE3] text-[#2C372F] border-[#DFDDD4] hover:bg-[#E2E0D6]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{quickStationeryBatchMode ? 'Stationery Batch Mode Active' : 'Stationery Batch Intake'}</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 sm:p-8 space-y-6"
      >
        {quickStationeryBatchMode && (
          <div className="bg-[#E2E0D6] border border-[#D5D3C8] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2C372F]">
                Small Item Stationery Batch Intake
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FBFBF9] text-[#2C372F]">
                30 Day Retention Policy
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#353D37] mb-1">
                  Batch Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={batchQuantity}
                  onChange={(e) => setBatchQuantity(e.target.value)}
                  className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#353D37] mb-1">
                  Stationery Box Label
                </label>
                <input
                  type="text"
                  value={batchLabel}
                  onChange={(e) => setBatchLabel(e.target.value)}
                  className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
            1. Public Item Details
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">Item Name</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Casio fx-991EX Scientific Calculator"
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-4 py-2.5 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
              Public Description (Do not include hidden ownership proof here)
            </label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="General visible appearance..."
              className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">Visible Colour</label>
              <input
                type="text"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">Brand</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">Material</label>
              <input
                type="text"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-[#DFDDD4]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#525B54]">
            2. Discovery Location and Retention Policy
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                Campus Location Found
              </label>
              <select
                value={foundLocation}
                onChange={(e) => {
                  setFoundLocation(e.target.value);
                  const locObj = locations.find((l) => l.name === e.target.value);
                  if (locObj && isAdmin) {
                    setStorageLocation(locObj.defaultVaultBin);
                  }
                }}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
              >
                {locations.map((loc) => (
                  <option key={loc._id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1.5">Date Found</label>
              <input
                type="date"
                required
                value={foundDate}
                onChange={(e) => setFoundDate(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                  Physical Storage Bin
                </label>
                <input
                  type="text"
                  required
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                  Retention Class
                </label>
                <select
                  value={retentionClass}
                  onChange={(e) => handleRetentionClassChange(e.target.value)}
                  className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
                >
                  {RETENTION_POLICIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
                  Retention Days
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#E2E0D6] rounded-2xl border border-[#D5D3C8] p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2C372F]">
            <Lock className="w-4 h-4" />
            <span>3. Restricted Ownership Verification Data</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1">
                Hidden Mark, Engraving, or Sticker
              </label>
              <input
                type="text"
                value={hiddenMarkOrScratch}
                onChange={(e) => setHiddenMarkOrScratch(e.target.value)}
                placeholder="e.g., Engraved initials A.S. on back cover"
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1">
                Serial Number or ID Fragment
              </label>
              <input
                type="text"
                value={serialOrIdFragment}
                onChange={(e) => setSerialOrIdFragment(e.target.value)}
                placeholder="e.g., Serial ending 8821"
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1">
                Internal Contents or Lock Screen Detail
              </label>
              <input
                type="text"
                value={lockedScreenOrContents}
                onChange={(e) => setLockedScreenOrContents(e.target.value)}
                placeholder="e.g., Formula note inside cover"
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1">
                Verification Prompt Shown to Claimants
              </label>
              <input
                type="text"
                value={verificationPrompt}
                onChange={(e) => setVerificationPrompt(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition disabled:opacity-50"
          >
            <PackagePlus className="w-4 h-4" />
            <span>{submitting ? 'Saving...' : 'Save Found Item'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
