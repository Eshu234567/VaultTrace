import React, { useState } from 'react';
import { X, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function ClaimModal({ item, lostReportId = null, onClose, onSuccess }) {
  const [identifyingDetailAnswer, setIdentifyingDetailAnswer] = useState('');
  const [serialOrContentsDetail, setSerialOrContentsDetail] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!item) return null;

  const verificationPrompt =
    item.verificationPrompt ||
    item.restrictedProof?.verificationPrompt ||
    'Describe any unique hidden mark, contents, lock screen wallpaper, or serial number fragment to prove ownership.';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifyingDetailAnswer.trim()) {
      setError('Please provide the required ownership verification details.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/claims', {
        method: 'POST',
        body: JSON.stringify({
          foundItemId: item._id,
          lostReportId,
          claimAnswers: {
            identifyingDetailAnswer: identifyingDetailAnswer.trim(),
            serialOrContentsDetail: serialOrContentsDetail.trim(),
            additionalContext: additionalContext.trim(),
          },
          proofRefs: proofUrl.trim()
            ? [{ url: proofUrl.trim(), description: 'Supporting Ownership Proof' }]
            : [],
        }),
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to submit claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[#F7F6F2] rounded-[28px] shadow-2xl border border-[#DFDDD4] max-w-lg w-full overflow-hidden">
        <div className="bg-[#2C372F] text-[#F7F6F2] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5" />
            <div>
              <h3 className="font-bold text-sm">Ownership Verification Claim</h3>
              <p className="text-xs text-[#C8D3C9] font-mono">
                {item.itemCode} ({item.itemName})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#C8D3C9] hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-[#ECEAE3] border border-[#DFDDD4] rounded-2xl p-4 text-xs text-[#2C372F] flex items-start gap-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Verification Prompt</span>
              {verificationPrompt}
            </div>
          </div>

          {error && (
            <div className="bg-[#F0E6E4] border border-[#DFC9C5] text-[#693B34] px-4 py-2.5 rounded-2xl text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#353D37] mb-1">
              Hidden Identifying Mark or Unique Ownership Proof
            </label>
            <textarea
              rows={3}
              required
              value={identifyingDetailAnswer}
              onChange={(e) => setIdentifyingDetailAnswer(e.target.value)}
              placeholder="Describe initials, stickers, hidden marks, or specific contents..."
              className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#353D37] mb-1">
              Serial Number Fragment or Internal Contents
            </label>
            <input
              type="text"
              value={serialOrContentsDetail}
              onChange={(e) => setSerialOrContentsDetail(e.target.value)}
              placeholder="Optional serial digits or card details"
              className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#353D37] mb-1">
              Additional Context
            </label>
            <input
              type="text"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Approximate time and spot where the item was left"
              className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#353D37] mb-1">
              Optional Reference Photo URL
            </label>
            <input
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#2C372F]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-[#D5D3C8] bg-[#FBFBF9] text-[#1F2621] text-xs font-semibold hover:bg-[#E2E0D6]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Submitting...' : 'Submit Claim'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
