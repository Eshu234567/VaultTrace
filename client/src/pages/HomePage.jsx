import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  PackagePlus,
  ShieldCheck,
  MapPin,
  Calendar,
  Lock,
  Info,
  QrCode,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusChip from '../components/StatusChip';
import QRTagModal from '../components/QRTagModal';
import ClaimModal from '../components/ClaimModal';

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

export default function HomePage() {
  const { isAdmin, locations, showToast } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [showHowMatchingWorks, setShowHowMatchingWorks] = useState(false);

  const [selectedItemForClaim, setSelectedItemForClaim] = useState(null);
  const [qrModalItem, setQrModalItem] = useState(null);

  const loadFoundItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'All') params.set('category', category);
      if (locationFilter !== 'All') params.set('location', locationFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await apiRequest(`/found-items?${params.toString()}`);
      setItems(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [category, locationFilter, search]);

  useEffect(() => {
    loadFoundItems();
  }, [loadFoundItems]);

  const storedCount = items.filter((i) =>
    ['Stored', 'Claim Pending'].includes(i.status)
  ).length;
  const activeZonesCount = new Set(items.map((i) => i.foundLocation).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      {/* Top Bento Section (Monochromatic Warm Stone & Sage Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Main Welcome & Search Card */}
        <div className="lg:col-span-8 bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-7 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="inline-block px-3.5 py-1 rounded-full bg-[#DDE2DC] text-[#2C372F] text-xs font-semibold">
              Intelligent Recovery System
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1F2621] tracking-tight">
              Search Found Inventory or Report a Missing Item
            </h1>
            <p className="text-xs sm:text-sm text-[#58605A] leading-relaxed max-w-2xl">
              Browse verified objects currently held in the campus vault. Ownership verification details remain private until an administrator reviews your claim.
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#687069] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by item name, brand, colour, or tag..."
                className="w-full pl-11 pr-4 py-3.5 rounded-full bg-[#FBFBF9] border border-[#D8D6CC] text-[#1F2621] placeholder:text-[#858C86] text-xs sm:text-sm focus:outline-none focus:border-[#2C372F]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/report-lost"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Report Lost Item</span>
              </Link>

              <Link
                to="/report-found"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#FBFBF9] hover:bg-[#E2E0D6] text-[#1F2621] border border-[#D5D3C8] text-xs font-semibold transition"
              >
                <PackagePlus className="w-4 h-4" />
                <span>{isAdmin ? 'Intake Found Item' : 'Report Found Item'}</span>
              </Link>

              <button
                onClick={() => setShowHowMatchingWorks(!showHowMatchingWorks)}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full text-xs font-medium text-[#4A544C] hover:text-[#1F2621]"
              >
                <Info className="w-4 h-4" />
                <span>{showHowMatchingWorks ? 'Hide Matching Rules' : 'How Matching Works'}</span>
              </button>
            </div>
          </div>

          {showHowMatchingWorks && (
            <div className="pt-4 border-t border-[#DCDAD0] grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {[
                { name: 'Category', weight: '25%', desc: 'Exact or related item category' },
                { name: 'Keywords', weight: '20%', desc: 'Name and description token overlap' },
                { name: 'Attributes', weight: '15%', desc: 'Colour, size, and material match' },
                { name: 'Campus Zone', weight: '15%', desc: 'Same building or nearby zone' },
                { name: 'Date Window', weight: '15%', desc: 'Proximity between lost and found dates' },
                { name: 'Brand', weight: '10%', desc: 'Visible manufacturer match' },
              ].map((sig, i) => (
                <div key={i} className="bg-[#F7F6F2] border border-[#DFDDD4] rounded-2xl p-3">
                  <div className="flex items-center justify-between font-bold text-[#1F2621] mb-1">
                    <span>{sig.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#E3E7E1] text-[#2C372F] text-[10px]">
                      {sig.weight}
                    </span>
                  </div>
                  <p className="text-[#606861] text-[11px]">{sig.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Monochromatic Summary Column (Inspired by Smartech Metric Cards) */}
        <div className="lg:col-span-4 bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-6 flex flex-col justify-between gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#525B54] px-1">
            Vault Status Summary
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 flex-1">
            <div className="bg-[#DDE2DC] rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-[#425046]">Available in Vault</div>
                <div className="text-2xl font-bold text-[#1F2621] mt-0.5">{storedCount}</div>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-[#2C372F]/20 flex items-center justify-center text-xs font-bold text-[#2C372F]">
                100%
              </div>
            </div>

            <div className="bg-[#E4E2DA] rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-[#525B54]">Campus Zones Covered</div>
                <div className="text-2xl font-bold text-[#1F2621] mt-0.5">{activeZonesCount}</div>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-[#2C372F]/20 flex items-center justify-center text-xs font-bold text-[#2C372F]">
                Live
              </div>
            </div>

            <div className="bg-[#F7F6F2] border border-[#DFDDD4] rounded-2xl p-4 flex items-center gap-3">
              <Lock className="w-4 h-4 text-[#425046] shrink-0" />
              <p className="text-[11px] text-[#58605A] leading-snug">
                Serial numbers, hidden marks, and storage bins are protected until claim approval.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Inventory Grid Section */}
      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#1F2621]">Found Item Inventory</h2>
            <p className="text-xs text-[#606861]">
              Select any item below to submit an ownership verification claim.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#606861]" />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="rounded-full border border-[#D5D3C8] bg-[#FBFBF9] px-4 py-2 text-xs font-medium text-[#1F2621] focus:outline-none focus:border-[#2C372F]"
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

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
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

        {/* Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-5 h-80 animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-12 text-center space-y-3">
            <h3 className="text-base font-bold text-[#1F2621]">
              No matching items in current storage
            </h3>
            <p className="text-xs text-[#606861] max-w-md mx-auto">
              Submit a Lost Item Report so the matching service can alert you automatically when a matching item is registered.
            </p>
            <div className="pt-2">
              <Link
                to="/report-lost"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2C372F] text-[#F7F6F2] text-xs font-semibold"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Report Lost Item</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item._id}
                className="bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] p-4 flex flex-col justify-between transition hover:border-[#C5C3B8]"
              >
                <div>
                  {/* Image container */}
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
                      <StatusChip
                        status={
                          !isAdmin && item.status === 'Claim Pending' ? 'Stored' : item.status
                        }
                        size="xs"
                      />
                    </div>
                  </div>

                  {/* Text details */}
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
                    {['Stored', 'Claim Pending'].includes(item.status) ? (
                      <button
                        onClick={() => setSelectedItemForClaim(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Claim This Item</span>
                      </button>
                    ) : (
                      <span className="flex-1 text-center py-2 text-xs text-[#687069] font-medium bg-[#F7F6F2] rounded-full">
                        {item.status}
                      </span>
                    )}

                    <button
                      onClick={() => setQrModalItem(item)}
                      className="p-2.5 rounded-full bg-[#F7F6F2] border border-[#DFDDD4] text-[#2C372F] hover:bg-[#E2E0D6] transition"
                      title="View QR Custody Tag"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedItemForClaim && (
        <ClaimModal
          item={selectedItemForClaim}
          onClose={() => setSelectedItemForClaim(null)}
          onSuccess={() => {
            setSelectedItemForClaim(null);
            loadFoundItems();
            showToast('Ownership claim submitted for administrator verification');
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
            {
              label: 'Status',
              value: !isAdmin && qrModalItem.status === 'Claim Pending' ? 'Stored' : qrModalItem.status,
            },
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
