import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Sparkles,
  ShieldCheck,
  QrCode,
  Archive,
  Send,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusChip from '../components/StatusChip';
import ClaimModal from '../components/ClaimModal';
import QRTagModal from '../components/QRTagModal';

const REPORT_TABS = ['All', 'Active', 'Possible Match', 'Claim Pending', 'Resolved'];

export default function MyActivityPage() {
  const { showToast } = useAuth();
  const [reports, setReports] = useState([]);
  const [claims, setClaims] = useState([]);
  const [reportTab, setReportTab] = useState('All');
  const [loading, setLoading] = useState(true);

  const [claimModalContext, setClaimModalContext] = useState(null);
  const [handoverQrClaim, setHandoverQrClaim] = useState(null);
  const [moreInfoAnswer, setMoreInfoAnswer] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [repRes, clmRes] = await Promise.all([
        apiRequest(`/lost-reports/mine?status=${encodeURIComponent(reportTab)}`),
        apiRequest('/claims/mine'),
      ]);
      setReports(repRes.data || []);
      setClaims(clmRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [reportTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleArchiveReport = async (reportId) => {
    try {
      await apiRequest(`/lost-reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: true }),
      });
      showToast('Report archived');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRespondMoreInfo = async (claimId) => {
    const text = moreInfoAnswer[claimId];
    if (!text || !text.trim()) return;
    try {
      await apiRequest(`/claims/${claimId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ additionalContext: text.trim() }),
      });
      showToast('Additional proof submitted to administrator');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1F2621]">
          Lost Reports, Matches and Claims
        </h1>
        <p className="text-xs text-[#606861]">
          Track active lost item reports, review candidate matches, and view claim verification decisions.
        </p>
      </div>

      {/* Lost Reports Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#1F2621] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2C372F]" />
            <span>Lost Item Reports</span>
          </h2>

          <div className="flex flex-wrap gap-1.5">
            {REPORT_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setReportTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition border ${
                  reportTab === tab
                    ? 'bg-[#2C372F] text-[#F7F6F2] border-[#2C372F]'
                    : 'bg-[#ECEAE3] text-[#4A544C] border-[#DFDDD4] hover:bg-[#E2E0D6]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-32 bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] animate-pulse p-6" />
        ) : reports.length === 0 ? (
          <div className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-8 text-center text-xs text-[#606861]">
            No lost reports found under {reportTab}.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((rep) => (
              <div
                key={rep._id}
                className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DFDDD4] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold px-3 py-1 rounded-full bg-[#2C372F] text-[#F7F6F2]">
                      {rep.reportCode}
                    </span>
                    <h3 className="font-bold text-base text-[#1F2621]">{rep.itemName}</h3>
                    <StatusChip status={rep.status} size="xs" />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#606861]">
                    <span>Location: <strong className="text-[#1F2621]">{rep.lastSeen?.location}</strong></span>
                    <span>{new Date(rep.lastSeen?.date).toLocaleDateString()}</span>
                    {rep.status !== 'Resolved' && (
                      <button
                        onClick={() => handleArchiveReport(rep._id)}
                        className="text-[#687069] hover:text-[#693B34] p-1 rounded"
                        title="Archive report"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#58605A]">{rep.description}</p>

                {rep.candidateMatches?.length > 0 && (
                  <div className="bg-[#F7F6F2] rounded-2xl border border-[#DFDDD4] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1F2621] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#2C372F]" />
                        <span>Candidate Matches ({rep.candidateMatches.length})</span>
                      </span>
                      <span className="text-[11px] text-[#606861]">
                        Submit a claim to verify ownership
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {rep.candidateMatches.map((cand) => {
                        const fItem = cand.foundItem;
                        if (!fItem) return null;
                        return (
                          <div
                            key={cand._id}
                            className="bg-[#ECEAE3] rounded-2xl border border-[#DFDDD4] p-4 flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#2C372F] text-[#F7F6F2]">
                                  {fItem.itemCode}
                                </span>
                                <span className="text-xs font-bold text-[#233829]">
                                  {cand.score}% Match ({cand.confidenceBand})
                                </span>
                              </div>
                              <h4 className="font-bold text-[#1F2621] text-sm">{fItem.itemName}</h4>
                              <p className="text-[11px] text-[#58605A]">
                                Found at <strong>{fItem.foundLocation}</strong> on{' '}
                                {new Date(fItem.foundAt).toLocaleDateString()}
                              </p>
                              <div className="flex flex-wrap gap-1 pt-1">
                                {cand.matchedFields?.map((mf, i) => (
                                  <span
                                    key={i}
                                    className="px-2.5 py-0.5 rounded-full bg-[#F7F6F2] text-[#2C372F] text-[10px] font-medium border border-[#DFDDD4]"
                                  >
                                    {mf}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {['Stored', 'Claim Pending'].includes(fItem.status) && (
                              <button
                                onClick={() =>
                                  setClaimModalContext({ item: fItem, lostReportId: rep._id })
                                }
                                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Claim This Item</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Submitted Claims Section */}
      <section className="space-y-4 pt-4 border-t border-[#DFDDD4]">
        <h2 className="text-lg font-bold text-[#1F2621] flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#2C372F]" />
          <span>Submitted Ownership Claims ({claims.length})</span>
        </h2>

        {claims.length === 0 ? (
          <div className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-8 text-center text-xs text-[#606861]">
            No ownership claims submitted yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {claims.map((clm) => (
              <div
                key={clm._id}
                className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold px-3 py-0.5 rounded-full bg-[#2C372F] text-[#F7F6F2]">
                      {clm.claimCode}
                    </span>
                    <StatusChip status={clm.status} size="xs" />
                  </div>

                  <div>
                    <h3 className="font-bold text-[#1F2621] text-base">
                      {clm.foundItemId?.itemName || 'Found Item'}
                    </h3>
                    <p className="text-xs text-[#606861] font-mono">
                      Item ID: {clm.foundItemId?.itemCode} ({new Date(clm.submittedAt).toLocaleDateString()})
                    </p>
                    <p className="text-xs text-[#353D37] mt-1">
                      Claimant:{' '}
                      <strong>{clm.claimantName || clm.claimantId?.name || 'Campus Student'}</strong>{' '}
                      <span className="font-mono">
                        ({clm.claimantUsn || clm.claimantId?.identifierCode || 'ID Verified'})
                      </span>
                    </p>
                  </div>

                  <div className="bg-[#F7F6F2] rounded-2xl p-3.5 border border-[#DFDDD4] text-xs space-y-1">
                    <div className="text-[#606861] font-semibold">Submitted Proof</div>
                    <p className="text-[#1F2621]">{clm.claimAnswers?.identifyingDetailAnswer}</p>
                    {clm.claimAnswers?.serialOrContentsDetail && (
                      <p className="text-[#58605A] font-mono text-[11px]">
                        Detail: {clm.claimAnswers.serialOrContentsDetail}
                      </p>
                    )}
                  </div>

                  {clm.adminFeedbackToClaimant && (
                    <div className="rounded-2xl p-3.5 border border-[#C9D1CD] bg-[#DDE6DF] text-[#233829] text-xs">
                      <span className="font-bold block mb-0.5">Administrator Decision</span>
                      {clm.adminFeedbackToClaimant}
                    </div>
                  )}

                  {clm.status === 'More Information Required' && (
                    <div className="space-y-2 pt-2">
                      <input
                        type="text"
                        value={moreInfoAnswer[clm._id] || ''}
                        onChange={(e) =>
                          setMoreInfoAnswer((prev) => ({ ...prev, [clm._id]: e.target.value }))
                        }
                        placeholder="Provide requested additional proof..."
                        className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2 text-xs"
                      />
                      <button
                        onClick={() => handleRespondMoreInfo(clm._id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2C372F] text-[#F7F6F2] text-xs font-semibold"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Proof</span>
                      </button>
                    </div>
                  )}
                </div>

                {['Approved', 'Handed Over'].includes(clm.status) && (
                  <div className="pt-3 border-t border-[#DFDDD4] flex items-center justify-between">
                    <div className="text-xs text-[#58605A]">
                      Bin: <strong className="text-[#1F2621]">{clm.foundItemId?.storageLocation}</strong>
                    </div>
                    <button
                      onClick={() => setHandoverQrClaim(clm)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Handover Pass</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {claimModalContext && (
        <ClaimModal
          item={claimModalContext.item}
          lostReportId={claimModalContext.lostReportId}
          onClose={() => setClaimModalContext(null)}
          onSuccess={() => {
            setClaimModalContext(null);
            loadData();
            showToast('Ownership claim submitted');
          }}
        />
      )}

      {handoverQrClaim && (
        <QRTagModal
          isOpen={Boolean(handoverQrClaim)}
          onClose={() => setHandoverQrClaim(null)}
          title={handoverQrClaim.foundItemId?.itemName || 'Approved Item'}
          subtitle="Verified Ownership Pass"
          code={handoverQrClaim.handoverPassCode || handoverQrClaim.claimCode}
          mode="handover"
          metadata={[
            { label: 'Claim Code', value: handoverQrClaim.claimCode },
            {
              label: 'Claimant Name',
              value: handoverQrClaim.claimantName || handoverQrClaim.claimantId?.name || 'Verified Claimant',
            },
            {
              label: 'USN / Campus ID',
              value: handoverQrClaim.claimantUsn || handoverQrClaim.claimantId?.identifierCode || 'ID Verified',
            },
            { label: 'Item Code', value: handoverQrClaim.foundItemId?.itemCode },
            { label: 'Status', value: handoverQrClaim.status },
            { label: 'Collection Location', value: handoverQrClaim.foundItemId?.storageLocation },
          ]}
        />
      )}
    </div>
  );
}
