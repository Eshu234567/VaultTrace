import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Archive,
  Sparkles,
  CheckSquare,
  Clock,
  ShieldAlert,
  Search,
  QrCode,
  CheckCircle2,
  XCircle,
  HelpCircle,
  PackageCheck,
  FastForward,
  HeartHandshake,
  RefreshCw,
  MapPin,
  Lock,
  Eye,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusChip from '../components/StatusChip';
import QRTagModal from '../components/QRTagModal';

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview and Analytics', icon: LayoutDashboard },
  { id: 'inventory', label: 'Vault Inventory', icon: Archive },
  { id: 'matches', label: 'Match Comparison', icon: Sparkles },
  { id: 'claims', label: 'Claims and Handover', icon: CheckSquare },
  { id: 'retention', label: 'Retention and Disposal', icon: Clock },
  { id: 'audit', label: 'Audit Logs', icon: ShieldAlert },
];

export default function AdminDashboardPage() {
  const { user, isAdmin, showToast, refreshUnread } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [globalCommandSearch, setGlobalCommandSearch] = useState('');

  const [analytics, setAnalytics] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [matches, setMatches] = useState([]);
  const [claims, setClaims] = useState([]);
  const [retentionData, setRetentionData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [invStatusFilter, setInvStatusFilter] = useState('All');

  const [inspectItemDetail, setInspectItemDetail] = useState(null);
  const [qrModalTarget, setQrModalTarget] = useState(null);
  const [disposalModalItem, setDisposalModalItem] = useState(null);
  const [handoverModalClaim, setHandoverModalClaim] = useState(null);

  const [disposalMethod, setDisposalMethod] = useState('Donate to Campus NGO / Drive');
  const [disposalReason, setDisposalReason] = useState(
    'Retention window elapsed with zero active claims. Approved for campus reuse and stationery donation.'
  );
  const [disposalOrg, setDisposalOrg] = useState('Campus Stationery Reuse Desk');

  const [recipientName, setRecipientName] = useState('');
  const [recipientIdentifier, setRecipientIdentifier] = useState('');
  const [handoverCondition, setHandoverCondition] = useState('Verified intact with campus ID');

  const loadAllAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [anaRes, invRes, matRes, clmRes, retRes, audRes] = await Promise.all([
        apiRequest('/admin/analytics/overview'),
        apiRequest('/found-items?limit=60'),
        apiRequest('/admin/matches'),
        apiRequest('/admin/claims'),
        apiRequest('/admin/retention/due'),
        apiRequest('/admin/audit-logs'),
      ]);
      setAnalytics(anaRes.data);
      setInventory(invRes.data || []);
      setMatches(matRes.data || []);
      setClaims(clmRes.data || []);
      setRetentionData(retRes.data);
      setAuditLogs(audRes.data || []);
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAllAdminData();
  }, [loadAllAdminData]);

  const openItemInspector = async (itemId) => {
    try {
      const res = await apiRequest(`/found-items/${itemId}`);
      setInspectItemDetail(res.data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleVerifyStudentTip = async (itemId) => {
    try {
      await apiRequest(`/found-items/${itemId}/verify-tip`, {
        method: 'PATCH',
        body: JSON.stringify({
          storageLocation: 'Central Vault Rack A, Bin 05',
        }),
      });
      showToast('Item verified into Stored inventory');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleClaimDecision = async (claimId, status) => {
    try {
      const feedback =
        status === 'Approved'
          ? 'Ownership verified against restricted clues. Present your Handover Pass at the Campus Vault.'
          : status === 'Rejected'
          ? 'Submitted answers did not match the restricted verification record for this item.'
          : 'Please provide additional proof such as sticker details, contents, or serial digits.';

      await apiRequest(`/admin/claims/${claimId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          reviewNotesPrivate: `Reviewed by ${user?.name}`,
          adminFeedbackToClaimant: feedback,
        }),
      });
      showToast(`Claim status updated to ${status}`);
      await refreshUnread();
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCompleteHandover = async (e) => {
    e.preventDefault();
    if (!handoverModalClaim) return;
    try {
      await apiRequest(`/admin/claims/${handoverModalClaim._id}/handover`, {
        method: 'POST',
        body: JSON.stringify({
          recipientName:
            recipientName ||
            handoverModalClaim.claimantName ||
            handoverModalClaim.claimantId?.name,
          recipientIdentifier:
            recipientIdentifier ||
            handoverModalClaim.claimantUsn ||
            handoverModalClaim.claimantId?.identifierCode,
          handoverCondition,
        }),
      });
      setHandoverModalClaim(null);
      showToast('Physical handover recorded and item marked as Returned');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSimulateTimeTravel = async (days = 40) => {
    try {
      const res = await apiRequest('/admin/retention/simulate-time-travel', {
        method: 'POST',
        body: JSON.stringify({ daysToFastForward: days }),
      });
      showToast(
        `Simulated ${days} days ageing: ${res.data.scanResult.movedToDisposalReview} item(s) moved to Disposal Review`
      );
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleExecuteDisposal = async (e) => {
    e.preventDefault();
    if (!disposalModalItem) return;
    try {
      await apiRequest('/admin/disposals', {
        method: 'POST',
        body: JSON.stringify({
          foundItemId: disposalModalItem._id,
          disposalMethod,
          reason: disposalReason,
          organizationOrDept: disposalOrg,
          witnessName: user?.name,
        }),
      });
      setDisposalModalItem(null);
      showToast(`Recorded ${disposalMethod} for ${disposalModalItem.itemCode}`);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredInventory = inventory.filter((item) => {
    if (invStatusFilter !== 'All' && item.status !== invStatusFilter) return false;
    if (globalCommandSearch.trim()) {
      const q = globalCommandSearch.toLowerCase();
      return (
        item.itemCode?.toLowerCase().includes(q) ||
        item.itemName?.toLowerCase().includes(q) ||
        item.storageLocation?.toLowerCase().includes(q) ||
        item.foundLocation?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-10 text-center space-y-4">
        <Lock className="w-8 h-8 text-[#2C372F] mx-auto" />
        <h2 className="text-lg font-bold text-[#1F2621]">Administrator Access Required</h2>
        <p className="text-xs text-[#606861]">
          Sign in as Administrator to manage vault inventory, approve claims, and oversee retention policies.
        </p>
        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#2C372F] text-[#F7F6F2] text-xs font-semibold hover:bg-[#1F2621]"
          >
            Go to Admin Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Admin Header */}
      <div className="bg-[#ECEAE3] rounded-[28px] p-6 sm:p-7 border border-[#DFDDD4] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#525B54] block mb-1">
            Custody, Verification and Retention
          </span>
          <h1 className="text-2xl font-bold text-[#1F2621]">Administrator Console</h1>
          <p className="text-xs text-[#606861]">
            All operational metrics and queues are backed by MongoDB aggregation pipelines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#687069] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalCommandSearch}
              onChange={(e) => {
                setGlobalCommandSearch(e.target.value);
                if (activeTab === 'overview') setActiveTab('inventory');
              }}
              placeholder="Search Item ID, bin, or name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#FBFBF9] border border-[#D5D3C8] text-xs text-[#1F2621] placeholder:text-[#858C86] focus:outline-none focus:border-[#2C372F]"
            />
          </div>

          <button
            onClick={loadAllAdminData}
            className="p-2.5 rounded-full bg-[#FBFBF9] border border-[#D5D3C8] hover:bg-[#E2E0D6] text-[#2C372F] transition"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {ADMIN_TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                active
                  ? 'bg-[#2C372F] text-[#F7F6F2] border-[#2C372F]'
                  : 'bg-[#ECEAE3] text-[#4A544C] border-[#DFDDD4] hover:bg-[#E2E0D6]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.id === 'claims' && analytics?.kpis?.pendingClaims > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#FBFBF9] text-[#1F2621] text-[10px] font-bold">
                  {analytics.kpis.pendingClaims}
                </span>
              )}
              {t.id === 'retention' && analytics?.kpis?.retentionReviewsDue > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#FBFBF9] text-[#1F2621] text-[10px] font-bold">
                  {analytics.kpis.retentionReviewsDue}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              {
                label: 'Items in Vault',
                val: analytics.kpis.itemsInStorage,
                sub: `${analytics.kpis.pendingVerificationTips} pending verification`,
              },
              {
                label: 'Active Lost Reports',
                val: analytics.kpis.activeLostReports,
                sub: `${analytics.kpis.totalLostReports} total reports`,
              },
              {
                label: 'Pending Claims',
                val: analytics.kpis.pendingClaims,
                sub: 'Awaiting proof review',
              },
              {
                label: 'High Matches',
                val: analytics.kpis.highConfidenceMatches,
                sub: 'Score 75% or above',
              },
              {
                label: 'Retention Reviews',
                val: analytics.kpis.retentionReviewsDue,
                sub: 'Eligible for disposal review',
              },
              {
                label: 'Returned and Donated',
                val: `${analytics.kpis.itemsReturned} / ${analytics.kpis.itemsDonatedOrDisposed}`,
                sub: `Avg turnaround ${analytics.kpis.avgRecoveryDays} days`,
              },
            ].map((k, idx) => (
              <div
                key={idx}
                className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-5 flex flex-col justify-between"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#58605A]">
                  {k.label}
                </span>
                <div className="text-2xl font-bold text-[#1F2621] my-1.5">{k.val}</div>
                <span className="text-[11px] text-[#687069]">{k.sub}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Campus Zone Matrix */}
            <div className="lg:col-span-7 bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[#1F2621] text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#2C372F]" />
                    <span>Campus Zone Activity Map</span>
                  </h3>
                  <p className="text-xs text-[#606861]">
                    Spatial aggregation across academic blocks, library, canteen, and auditorium.
                  </p>
                </div>
                <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#FBFBF9] border border-[#DFDDD4] text-[#353D37] font-semibold">
                  $group by foundLocation
                </span>
              </div>

              <div className="relative h-64 rounded-2xl bg-[#DDE2DC] border border-[#CBD2C7] overflow-hidden p-4">
                {analytics.heatmapZones?.map((zone, idx) => (
                  <div
                    key={idx}
                    style={{
                      left: `${zone.coordinates?.x || 50}%`,
                      top: `${zone.coordinates?.y || 50}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#2C372F] text-[#F7F6F2] flex items-center justify-center font-bold text-xs shadow-sm border-2 border-[#F7F6F2] transition transform group-hover:scale-110">
                      {zone.totalActivity}
                    </div>
                    <div className="mt-1 px-2.5 py-0.5 rounded-full bg-[#FBFBF9]/90 text-[10px] text-[#1F2621] font-semibold whitespace-nowrap border border-[#DFDDD4]">
                      {zone.name.split(' - ')[0].split(' (')[0]}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {analytics.heatmapZones?.slice(0, 4).map((z, i) => (
                  <div key={i} className="bg-[#F7F6F2] rounded-2xl p-3 border border-[#DFDDD4] text-xs">
                    <div className="font-bold text-[#1F2621] truncate">{z.name}</div>
                    <div className="text-[11px] text-[#58605A] mt-0.5">
                      Found: <strong>{z.foundCount}</strong> / Lost: <strong>{z.lostCount}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Distribution Chart */}
            <div className="lg:col-span-5 bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-bold text-[#1F2621] text-base">
                  Inventory by Category
                </h3>
                <p className="text-xs text-[#606861]">
                  Backed by MongoDB <code className="font-mono">$group</code> aggregation pipeline.
                </p>
              </div>

              <div className="h-60 w-full bg-[#F7F6F2] rounded-2xl p-3 border border-[#DFDDD4]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.categoryBreakdown || []}>
                    <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#4A544C' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#4A544C' }} />
                    <Tooltip />
                    <Bar dataKey="totalItems" name="Total Logged" fill="#2C372F" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="returnedCount" name="Returned" fill="#8C9A8E" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-[#353D37]">
                  Unclaimed Inventory by Retention Policy
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {analytics.retentionClassBreakdown?.map((rc, i) => (
                    <div
                      key={i}
                      className="px-3.5 py-2.5 rounded-2xl bg-[#F7F6F2] border border-[#DFDDD4] flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-[#4A544C] truncate">{rc._id}</span>
                      <span className="font-mono font-bold text-[#1F2621]">
                        {rc.itemRecords} ({rc.physicalUnits})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#353D37] mr-1">Filter Status:</span>
            {[
              'All',
              'Pending Verification',
              'Stored',
              'Claim Pending',
              'Approved',
              'Returned',
              'Disposal Review',
              'Donated',
            ].map((st) => (
              <button
                key={st}
                onClick={() => setInvStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                  invStatusFilter === st
                    ? 'bg-[#2C372F] text-[#F7F6F2] border-[#2C372F]'
                    : 'bg-[#FBFBF9] text-[#4A544C] border-[#D5D3C8] hover:bg-[#E2E0D6]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#E2E0D6] text-[#353D37] uppercase text-[11px] tracking-wider border-b border-[#D5D3C8]">
                    <th className="py-3.5 px-4">Item Code</th>
                    <th className="py-3.5 px-4">Item and Category</th>
                    <th className="py-3.5 px-4">Found Location</th>
                    <th className="py-3.5 px-4">Vault Storage Bin</th>
                    <th className="py-3.5 px-4">Retention Policy</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFDDD4]">
                  {filteredInventory.map((item) => (
                    <tr key={item._id} className="hover:bg-[#F7F6F2]/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#1F2621] whitespace-nowrap">
                        {item.itemCode}
                        {item.isBatchStationery && (
                          <span className="block text-[10px] text-[#58605A] font-sans">
                            Batch: {item.batchQuantity} units
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#1F2621] text-sm">{item.itemName}</div>
                        <div className="text-[#58605A]">
                          {item.category} ({item.visibleAttributes?.colour})
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#1F2621]">{item.foundLocation}</div>
                        <div className="text-[#687069]">
                          {new Date(item.foundAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#353D37]">
                        {item.storageLocation}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-[#1F2621]">{item.retentionClass}</span>
                        <span className="block text-[11px] text-[#687069]">
                          Due {new Date(item.eligibleForDisposalAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusChip status={item.status} size="xs" />
                        {item.status === 'Returned' && item.handoverDetails?.recipientName && (
                          <div className="text-[11px] text-[#353D37] mt-1">
                            To: <strong>{item.handoverDetails.recipientName}</strong>{' '}
                            <span className="font-mono">
                              ({item.handoverDetails.recipientIdentifier})
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                        {item.status === 'Pending Verification' && (
                          <button
                            onClick={() => handleVerifyStudentTip(item._id)}
                            className="px-3 py-1.5 rounded-full bg-[#2C372F] text-[#F7F6F2] font-semibold hover:bg-[#1F2621] transition"
                          >
                            Verify to Vault
                          </button>
                        )}
                        <button
                          onClick={() => openItemInspector(item._id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FBFBF9] border border-[#D5D3C8] hover:bg-[#E2E0D6] text-[#1F2621] font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                        <button
                          onClick={() => setQrModalTarget(item)}
                          className="p-1.5 rounded-full bg-[#FBFBF9] border border-[#D5D3C8] text-[#2C372F] hover:bg-[#E2E0D6]"
                          title="Print Storage QR Tag"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MATCHES */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-5">
            <div>
              <h2 className="text-base font-bold text-[#1F2621]">
                Candidate Match Comparison ({matches.length})
              </h2>
              <p className="text-xs text-[#606861]">
                Weighted score breakdown across Category (25%), Keywords (20%), Attributes (15%), Location (15%), Date (15%), and Brand (10%).
              </p>
            </div>
            <button
              onClick={async () => {
                await apiRequest('/admin/matches/reconcile', { method: 'POST' });
                showToast('Reconciled all active lost reports against stored inventory');
                loadAllAdminData();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#2C372F] text-[#F7F6F2] text-xs font-semibold hover:bg-[#1F2621]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconcile Matches</span>
            </button>
          </div>

          <div className="space-y-4">
            {matches.map((m) => (
              <div
                key={m._id}
                className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFDDD4] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#DDE6DF] text-[#233829] border border-[#B8CBBF]">
                      {m.score}% Match ({m.confidenceBand})
                    </span>
                    <span className="text-xs text-[#58605A]">{m.explanation}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold px-3 py-1 rounded-full bg-[#F7F6F2] border border-[#DFDDD4] text-[#353D37]">
                    {m.state}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px]">
                  {[
                    { label: 'Category (25)', val: m.scoreBreakdown?.categoryScore },
                    { label: 'Keywords (20)', val: m.scoreBreakdown?.keywordScore },
                    { label: 'Attributes (15)', val: m.scoreBreakdown?.attributeScore },
                    { label: 'Location (15)', val: m.scoreBreakdown?.locationScore },
                    { label: 'Date (15)', val: m.scoreBreakdown?.dateScore },
                    { label: 'Brand (10)', val: m.scoreBreakdown?.brandScore },
                  ].map((s, idx) => (
                    <div key={idx} className="bg-[#F7F6F2] rounded-xl px-3 py-2 border border-[#DFDDD4] flex justify-between">
                      <span className="text-[#606861]">{s.label}</span>
                      <strong className="text-[#1F2621]">+{s.val || 0}</strong>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-[#F7F6F2] border border-[#DFDDD4] p-4 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-[#353D37]">
                      <span>LOST REPORT: {m.lostReportId?.reportCode}</span>
                      <span>{m.lostReportId?.lastSeen?.location}</span>
                    </div>
                    <div className="text-sm font-bold text-[#1F2621]">{m.lostReportId?.itemName}</div>
                    <p className="text-[#58605A]">{m.lostReportId?.description}</p>
                  </div>

                  <div className="rounded-2xl bg-[#F7F6F2] border border-[#DFDDD4] p-4 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-[#353D37]">
                      <span>FOUND ITEM: {m.foundItemId?.itemCode}</span>
                      <span>Bin: {m.foundItemId?.storageLocation}</span>
                    </div>
                    <div className="text-sm font-bold text-[#1F2621]">{m.foundItemId?.itemName}</div>
                    <p className="text-[#58605A]">{m.foundItemId?.description}</p>
                    <div className="text-[#2C372F] bg-[#E3E7E1] px-3 py-1.5 rounded-xl font-medium mt-1">
                      Restricted Proof: {m.foundItemId?.restrictedProof?.hiddenMarkOrScratch}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CLAIMS */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-5">
            <h2 className="text-base font-bold text-[#1F2621]">
              Ownership Claim Verification Queue ({claims.length})
            </h2>
            <p className="text-xs text-[#606861]">
              Compare submitted claim answers against the restricted verification record. Only one active approved claim is permitted per item.
            </p>
          </div>

          <div className="space-y-4">
            {claims.map((clm) => (
              <div
                key={clm._id}
                className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFDDD4] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold px-3 py-1 rounded-full bg-[#2C372F] text-[#F7F6F2]">
                      {clm.claimCode}
                    </span>
                    <h3 className="font-bold text-base text-[#1F2621]">
                      {clm.foundItemId?.itemName} ({clm.foundItemId?.itemCode})
                    </h3>
                    <StatusChip status={clm.status} size="xs" />
                  </div>
                  <div className="text-xs text-[#58605A]">
                    Claimant:{' '}
                    <strong className="text-[#1F2621]">
                      {clm.claimantName || clm.claimantId?.name || 'Student'}
                    </strong>{' '}
                    <span className="font-mono font-semibold text-[#2C372F]">
                      ({clm.claimantUsn || clm.claimantId?.identifierCode || 'No USN'})
                    </span>{' '}
                    · Submitted {new Date(clm.submittedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-[#F7F6F2] border border-[#DFDDD4] rounded-2xl p-4 space-y-1.5">
                    <div className="font-bold text-[#353D37] uppercase tracking-wider text-[11px]">
                      Claimant Identity and Proof Answers
                    </div>
                    <p className="text-[#1F2621]">
                      <strong>Name & USN:</strong>{' '}
                      {clm.claimantName || clm.claimantId?.name || 'Student'}{' '}
                      <span className="font-mono font-semibold">
                        ({clm.claimantUsn || clm.claimantId?.identifierCode || 'N/A'})
                      </span>
                    </p>
                    <p className="text-[#1F2621] font-medium">
                      <strong>Identifying Detail:</strong> {clm.claimAnswers?.identifyingDetailAnswer}
                    </p>
                    <p className="text-[#58605A] font-mono">
                      <strong>Serial or Contents:</strong>{' '}
                      {clm.claimAnswers?.serialOrContentsDetail || 'Not specified'}
                    </p>
                    <p className="text-[#58605A]">
                      <strong>Context:</strong> {clm.claimAnswers?.additionalContext || 'Not specified'}
                    </p>
                  </div>

                  <div className="bg-[#E2E0D6] border border-[#D5D3C8] rounded-2xl p-4 space-y-1.5">
                    <div className="font-bold text-[#2C372F] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Restricted Verification Record</span>
                    </div>
                    <p className="text-[#1F2621] font-medium">
                      <strong>Hidden Mark:</strong>{' '}
                      {clm.foundItemId?.restrictedProof?.hiddenMarkOrScratch || 'None'}
                    </p>
                    <p className="text-[#353D37] font-mono">
                      <strong>Serial Fragment:</strong>{' '}
                      {clm.foundItemId?.restrictedProof?.serialOrIdFragment || 'None'}
                    </p>
                    <p className="text-[#58605A]">
                      <strong>Internal Contents:</strong>{' '}
                      {clm.foundItemId?.restrictedProof?.lockedScreenOrContents || 'None'}
                    </p>
                    <p className="text-[#2C372F] font-mono font-semibold pt-1">
                      Storage Bin: {clm.foundItemId?.storageLocation}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#DFDDD4]">
                  <div className="text-xs text-[#58605A]">
                    {clm.handoverPassCode && (
                      <span className="font-mono font-bold text-[#233829]">
                        Handover Pass: {clm.handoverPassCode}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {['Pending', 'More Information Required'].includes(clm.status) && (
                      <>
                        <button
                          onClick={() => handleClaimDecision(clm._id, 'Approved')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approve Claim</span>
                        </button>
                        <button
                          onClick={() =>
                            handleClaimDecision(clm._id, 'More Information Required')
                          }
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FBFBF9] border border-[#D5D3C8] hover:bg-[#E2E0D6] text-[#1F2621] text-xs font-semibold transition"
                        >
                          <HelpCircle className="w-4 h-4" />
                          <span>Request More Info</span>
                        </button>
                        <button
                          onClick={() => handleClaimDecision(clm._id, 'Rejected')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F0E6E4] border border-[#DFC9C5] text-[#693B34] text-xs font-semibold transition"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Decline</span>
                        </button>
                      </>
                    )}

                    {clm.status === 'Approved' && (
                      <button
                        onClick={() => {
                          setHandoverModalClaim(clm);
                          setRecipientName(clm.claimantName || clm.claimantId?.name || '');
                          setRecipientIdentifier(
                            clm.claimantUsn || clm.claimantId?.identifierCode || ''
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Record Physical Handover</span>
                      </button>
                    )}
                    {clm.status === 'Handed Over' && clm.foundItemId?.handoverDetails && (
                      <span className="text-xs text-[#233829] font-semibold">
                        Returned to {clm.foundItemId.handoverDetails.recipientName} (
                        <span className="font-mono">
                          {clm.foundItemId.handoverDetails.recipientIdentifier}
                        </span>
                        )
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: RETENTION AND DISPOSAL */}
      {activeTab === 'retention' && retentionData && (
        <div className="space-y-6">
          <div className="bg-[#2C372F] text-[#F7F6F2] rounded-[28px] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#C8D3C9]">
                <FastForward className="w-4 h-4" />
                <span>Retention Eligibility Simulator</span>
              </div>
              <h3 className="text-base font-bold">
                Test Small Item Stationery Retention and Claim Freeze
              </h3>
              <p className="text-xs text-[#C8D3C9] max-w-2xl">
                Advance small item ages by 40 days to demonstrate how expired unclaimed items enter Disposal Review while items with active claims remain frozen.
              </p>
            </div>

            <button
              onClick={() => handleSimulateTimeTravel(40)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#F7F6F2] hover:bg-[#E2E0D6] text-[#1F2621] text-xs font-bold transition shrink-0"
            >
              <FastForward className="w-4 h-4" />
              <span>Simulate 40 Days Ageing</span>
            </button>
          </div>

          <div className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 space-y-4">
            <h3 className="font-bold text-[#1F2621] text-base">
              Items Awaiting Disposal or Donation Approval (
              {retentionData.disposalReviewQueue?.length || 0})
            </h3>

            {retentionData.disposalReviewQueue?.length === 0 ? (
              <p className="text-xs text-[#606861]">
                No items are currently in Disposal Review.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {retentionData.disposalReviewQueue.map((item) => (
                  <div
                    key={item._id}
                    className="rounded-2xl border border-[#DFDDD4] bg-[#F7F6F2] p-5 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold px-3 py-0.5 rounded-full bg-[#2C372F] text-[#F7F6F2]">
                          {item.itemCode}
                        </span>
                        <StatusChip status={item.status} size="xs" />
                      </div>
                      <h4 className="font-bold text-[#1F2621] text-sm">{item.itemName}</h4>
                      <p className="text-xs text-[#58605A]">
                        Class: <strong>{item.retentionClass}</strong> ({item.retentionDays} days)
                      </p>
                      <p className="text-[11px] text-[#693B34] font-medium">
                        Eligible since {new Date(item.eligibleForDisposalAt).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={() => setDisposalModalItem(item)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
                    >
                      <HeartHandshake className="w-4 h-4" />
                      <span>Approve Donation or Disposal</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 space-y-3">
            <h3 className="font-bold text-[#1F2621] text-base">
              Disposal and Donation Registry ({retentionData.disposalHistory?.length || 0})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#E2E0D6] text-[#353D37] uppercase text-[11px]">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Item Snapshot</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Method and Recipient</th>
                    <th className="py-3 px-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFDDD4]">
                  {retentionData.disposalHistory?.map((rec) => (
                    <tr key={rec._id}>
                      <td className="py-3 px-4 font-mono font-bold text-[#1F2621]">
                        {rec.disposalCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1F2621]">{rec.itemNameSnapshot}</div>
                        <div className="font-mono text-[#606861]">{rec.itemCodeSnapshot}</div>
                      </td>
                      <td className="py-3 px-4 font-bold">{rec.quantityDisposed}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#1F2621]">{rec.disposalMethod}</div>
                        <div className="text-[#58605A]">
                          {rec.recipientOrWitness?.organizationOrDept}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#58605A] max-w-xs">{rec.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] overflow-hidden">
          <div className="p-5 border-b border-[#DFDDD4]">
            <h2 className="text-base font-bold text-[#1F2621]">
              Audit Log ({auditLogs.length})
            </h2>
            <p className="text-xs text-[#606861]">
              Records state transitions, claim decisions, handovers, and database modifications.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#E2E0D6] text-[#353D37] uppercase text-[11px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">State Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFDDD4]">
                {auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-[#F7F6F2]/60">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-[#1F2621]">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="font-mono text-[10px] text-[#687069]">{log.requestId}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#353D37] uppercase">{log.actorRole}</td>
                    <td className="py-3 px-4 font-mono font-bold text-[#1F2621]">{log.action}</td>
                    <td className="py-3 px-4 font-mono text-[#58605A]">{log.entityType}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#58605A] max-w-md truncate">
                      {JSON.stringify(log.afterSummary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Modal */}
      {inspectItemDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#F7F6F2] rounded-[28px] shadow-2xl border border-[#DFDDD4] max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DFDDD4] pb-3">
              <div>
                <span className="font-mono text-xs font-semibold px-3 py-0.5 rounded-full bg-[#2C372F] text-[#F7F6F2]">
                  {inspectItemDetail.item.itemCode}
                </span>
                <h3 className="text-lg font-bold text-[#1F2621] mt-1">
                  {inspectItemDetail.item.itemName}
                </h3>
              </div>
              <button
                onClick={() => setInspectItemDetail(null)}
                className="px-4 py-1.5 rounded-full border border-[#D5D3C8] bg-[#FBFBF9] text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="bg-[#ECEAE3] border border-[#DFDDD4] rounded-2xl p-4 text-xs space-y-1">
              <div className="font-bold text-[#1F2621]">Restricted Verification Panel</div>
              <div>
                Hidden Mark: <strong>{inspectItemDetail.item.restrictedProof?.hiddenMarkOrScratch}</strong>
              </div>
              <div>
                Serial Fragment: <strong>{inspectItemDetail.item.restrictedProof?.serialOrIdFragment}</strong>
              </div>
              <div>
                Storage Bin: <strong>{inspectItemDetail.item.storageLocation}</strong>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#58605A]">
                Custody Timeline (itemEvents)
              </h4>
              <div className="space-y-2">
                {inspectItemDetail.events?.map((ev) => (
                  <div
                    key={ev._id}
                    className="p-3.5 rounded-2xl bg-[#ECEAE3] border border-[#DFDDD4] text-xs flex items-start justify-between gap-3"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#1F2621]">{ev.eventType}</span>
                      <span className="mx-2 text-[#687069]">to</span>
                      <span className="font-semibold text-[#353D37]">{ev.toStatus}</span>
                      <p className="text-[#58605A] mt-0.5">{ev.note}</p>
                    </div>
                    <div className="text-right text-[11px] text-[#687069] shrink-0">
                      {new Date(ev.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Handover Modal */}
      {handoverModalClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCompleteHandover}
            className="bg-[#F7F6F2] rounded-[28px] shadow-2xl border border-[#DFDDD4] max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-[#1F2621]">
              Record Physical Handover
            </h3>
            <p className="text-xs text-[#58605A]">
              {handoverModalClaim.foundItemId?.itemName} ({handoverModalClaim.foundItemId?.itemCode})
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1">
                Recipient Name
              </label>
              <input
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1">
                Verified Campus ID
              </label>
              <input
                type="text"
                required
                value={recipientIdentifier}
                onChange={(e) => setRecipientIdentifier(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1">
                Item Condition at Handover
              </label>
              <input
                type="text"
                required
                value={handoverCondition}
                onChange={(e) => setHandoverCondition(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setHandoverModalClaim(null)}
                className="px-4 py-2 rounded-full border border-[#D5D3C8] bg-[#FBFBF9] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-[#2C372F] text-[#F7F6F2] text-xs font-semibold"
              >
                Confirm Handover
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Disposal Modal */}
      {disposalModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form
            onSubmit={handleExecuteDisposal}
            className="bg-[#F7F6F2] rounded-[28px] shadow-2xl border border-[#DFDDD4] max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-[#1F2621]">
              Approve Retention Action ({disposalModalItem.itemCode})
            </h3>
            <p className="text-xs text-[#58605A]">
              {disposalModalItem.itemName}
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1">
                Action Method
              </label>
              <select
                value={disposalMethod}
                onChange={(e) => setDisposalMethod(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2 text-xs"
              >
                <option value="Donate to Campus NGO / Drive">Donate to Campus NGO / Drive</option>
                <option value="Transfer to Shared Stationery Desk">
                  Transfer to Shared Stationery Desk
                </option>
                <option value="Transfer to Department Lab">Transfer to Department Lab</option>
                <option value="Responsible E-Waste / Material Recycling">
                  Responsible E-Waste / Material Recycling
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1">
                Recipient Organization or Department
              </label>
              <input
                type="text"
                required
                value={disposalOrg}
                onChange={(e) => setDisposalOrg(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#353D37] mb-1">
                Approval Reason
              </label>
              <textarea
                rows={2}
                required
                value={disposalReason}
                onChange={(e) => setDisposalReason(e.target.value)}
                className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-3.5 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDisposalModalItem(null)}
                className="px-4 py-2 rounded-full border border-[#D5D3C8] bg-[#FBFBF9] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-[#2C372F] text-[#F7F6F2] text-xs font-semibold"
              >
                Confirm Action
              </button>
            </div>
          </form>
        </div>
      )}

      {qrModalTarget && (
        <QRTagModal
          isOpen={Boolean(qrModalTarget)}
          onClose={() => setQrModalTarget(null)}
          title={qrModalTarget.itemName}
          subtitle={qrModalTarget.storageLocation}
          code={qrModalTarget.itemCode}
          mode="storage"
          metadata={[
            { label: 'Category', value: qrModalTarget.category },
            { label: 'Storage Bin', value: qrModalTarget.storageLocation },
            { label: 'Status', value: qrModalTarget.status },
            { label: 'Retention', value: `${qrModalTarget.retentionClass} (${qrModalTarget.retentionDays}d)` },
          ]}
        />
      )}
    </div>
  );
}
