import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ShieldCheck,
  MapPin,
  Calendar,
  QrCode,
  Lock,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusChip from '../components/StatusChip';
import ClaimModal from '../components/ClaimModal';
import QRTagModal from '../components/QRTagModal';

const CATEGORIES = [
  'All',
  'Electronics',
  'ID / Smart Card',
  'Calculator / Lab Gear',
  'Bottle / Flask',
  'Wallet / Purse',
  'Keys / Keychain',
  'Stationery',
  'Bag / Backpack',
  'Spectacles / Eyewear',
  'Books / Notes',
  'Other',
];

export default function MyActivityPage() {
  const { isAdmin, locations, showToast } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');

  const [selectedItemForClaim, setSelectedItemForClaim] = useState(null);
  const [qrModalItem, setQrModalItem] = useState(null);

  const loadClaimableItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'All') params.set('category', category);
      if (locationFilter !== 'All') params.set('location', locationFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiRequest(`/found-items?${params.toString()}`);
      const allItems = res.data || [];
      // Only show items in the vault that have NOT yet been approved/returned/disposed
      const unclaimedItems = allItems.filter((item) =>
        ['Stored', 'Claim Pending'].includes(item.status)
      );
      setItems(unclaimedItems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [category, locationFilter, search]);

  useEffect(() => {
    loadClaimableItems();
  }, [loadClaimableItems]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2 max-w-2xl">
          <span className="inline-block px-3 py-1 rounded-full bg-[#DDE2DC] text-[#2C372F] text-xs font-semibold">
            Vault Custody Verification
          </span>
          <h1 className="text-2xl font-bold text-[#1F2621]">
            Items Available to Claim ({items.length})
          </h1>
          <p className="text-xs text-[#606861] leading-relaxed">
            Browse all items currently held in the campus vault that are yet to be approved or claimed. To protect student privacy and prevent impersonation, claim submissions are confidential and require your Full Name, USN, and hidden ownership proof.
          </p>
        </div>

        <div className="bg-[#F7F6F2] border border-[#DFDDD4] rounded-2xl p-4 flex items-center gap-3 max-w-xs shrink-0">
          <Lock className="w-4 h-4 text-[#2C372F] shrink-0" />
          <p className="text-[11px] text-[#58605A] leading-snug">
            Submitted claims are visible only to the Vault Administrator during verification.
          </p>
        </div>
      </div>

      {/* Search and Location Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#687069] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search unclaimed items by name, brand, colour, or item code..."
            className="w-full pl-11 pr-4 py-3 rounded-full bg-[#FBFBF9] border border-[#D8D6CC] text-[#1F2621] placeholder:text-[#858C86] text-xs focus:outline-none focus:border-[#2C372F]"
          />
        </div>

        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#606861] shrink-0" />
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full sm:w-auto rounded-full border border-[#D5D3C8] bg-[#FBFBF9] px-4 py-3 text-xs font-medium text-[#1F2621] focus:outline-none focus:border-[#2C372F]"
          >
            <option value="All">All Campus Locations</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
              category === cat
                ? 'bg-[#2C372F] text-[#F7F6F2] border-[#2C372F]'
                : 'bg-[#ECEAE3] text-[#4A544C] border-[#DFDDD4] hover:bg-[#E2E0D6]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Claimable Inventory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-5 h-72 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-12 text-center space-y-2">
          <h3 className="text-base font-bold text-[#1F2621]">
            No unclaimed items match your filter
          </h3>
          <p className="text-xs text-[#606861] max-w-md mx-auto">
            All matching items have either been returned to their verified owners or none match your search filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            // Do not publicly expose whether another user has filed a claim ("Claim Pending")
            const displayStatus = isAdmin ? item.status : 'Stored';
            return (
              <div
                key={item._id}
                className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-4 flex flex-col justify-between transition hover:border-[#C5C3B8]"
              >
                <div>
                  <div className="relative h-44 rounded-2xl bg-[#E2E0D6] overflow-hidden mb-4">
                    {item.imageRefs?.[0]?.url ? (
                      <img
                        src={item.imageRefs[0].url}
                        alt={item.itemName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#687069] text-xs font-medium">
                        No Reference Photo
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold px-3 py-1 rounded-full bg-[#FBFBF9]/90 text-[#1F2621] backdrop-blur-sm">
                        {item.itemCode}
                      </span>
                      {item.isBatchStationery && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#2C372F]/90 text-[#F7F6F2]">
                          Batch ({item.batchQuantity})
                        </span>
                      )}
                    </div>
                    <div className="absolute top-3 right-3">
                      <StatusChip status={displayStatus} size="xs" />
                    </div>
                  </div>

                  <div className="px-1 space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#58605A] font-medium">
                      <span>{item.category}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(item.foundAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-bold text-[#1F2621] text-base line-clamp-1">
                      {item.itemName}
                    </h3>
                    <p className="text-xs text-[#58605A] line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.visibleAttributes?.colour && (
                        <span className="px-2.5 py-1 rounded-full bg-[#F7F6F2] border border-[#DFDDD4] text-[#353D37] text-[11px] font-medium">
                          {item.visibleAttributes.colour}
                        </span>
                      )}
                      {item.visibleAttributes?.brand && (
                        <span className="px-2.5 py-1 rounded-full bg-[#F7F6F2] border border-[#DFDDD4] text-[#353D37] text-[11px] font-medium">
                          {item.visibleAttributes.brand}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-1 pt-4 mt-4 border-t border-[#DFDDD4] space-y-3">
                  <div className="flex items-center gap-1.5 text-xs text-[#4A544C]">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{item.foundLocation}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedItemForClaim(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Claim This Item</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQrModalItem(item)}
                      className="p-2.5 rounded-full bg-[#F7F6F2] border border-[#DFDDD4] text-[#2C372F] hover:bg-[#E2E0D6] transition"
                      title="View QR Custody Tag"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedItemForClaim && (
        <ClaimModal
          item={selectedItemForClaim}
          onClose={() => setSelectedItemForClaim(null)}
          onSuccess={() => {
            setSelectedItemForClaim(null);
            loadClaimableItems();
            showToast('Ownership claim submitted confidentially to the Vault Administrator');
          }}
        />
      )}

      {qrModalItem && (
        <QRTagModal
          isOpen={Boolean(qrModalItem)}
          onClose={() => setQrModalItem(null)}
          title={qrModalItem.itemName}
          subtitle={qrModalItem.category}
          code={qrModalItem.itemCode}
          mode="storage"
          metadata={[
            { label: 'Found Location', value: qrModalItem.foundLocation },
            { label: 'Found Date', value: new Date(qrModalItem.foundAt).toLocaleDateString() },
            { label: 'Status', value: isAdmin ? qrModalItem.status : 'Stored' },
            { label: 'Retention Class', value: qrModalItem.retentionClass },
            {
              label: 'Storage Bin',
              value: isAdmin ? qrModalItem.storageLocation : 'Protected Until Approval',
            },
          ]}
        />
      )}
    </div>
  );
}
