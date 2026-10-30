import React from 'react';
import {
  CheckCircle2,
  Clock,
  ShieldAlert,
  Archive,
  Sparkles,
  PackageCheck,
  AlertTriangle,
  HeartHandshake,
  HelpCircle,
} from 'lucide-react';

const STATUS_STYLES = {
  Stored: {
    bg: 'bg-[#E3E7E1] text-[#2F3E33] border-[#CBD2C7]',
    icon: Archive,
    label: 'Stored in Vault',
  },
  'Pending Verification': {
    bg: 'bg-[#EFECE4] text-[#5C533B] border-[#DDD6C5]',
    icon: Clock,
    label: 'Pending Verification',
  },
  'Claim Pending': {
    bg: 'bg-[#E6EAE8] text-[#35453E] border-[#C9D1CD]',
    icon: Clock,
    label: 'Claim Pending',
  },
  Approved: {
    bg: 'bg-[#DDE6DF] text-[#233829] border-[#B8CBBF]',
    icon: CheckCircle2,
    label: 'Approved for Pickup',
  },
  Returned: {
    bg: 'bg-[#EAE9E4] text-[#484A47] border-[#D4D2C9]',
    icon: PackageCheck,
    label: 'Returned to Owner',
  },
  'Disposal Review': {
    bg: 'bg-[#F0E6E4] text-[#693B34] border-[#DFC9C5]',
    icon: AlertTriangle,
    label: 'Disposal Review',
  },
  Donated: {
    bg: 'bg-[#E7E9E4] text-[#3A463B] border-[#CCD1C7]',
    icon: HeartHandshake,
    label: 'Donated or Reused',
  },
  Disposed: {
    bg: 'bg-[#EAE9E4] text-[#575652] border-[#D5D3CA]',
    icon: Archive,
    label: 'Disposed',
  },
  Active: {
    bg: 'bg-[#E3E7E1] text-[#2F3E33] border-[#CBD2C7]',
    icon: Clock,
    label: 'Active Search',
  },
  'Possible Match': {
    bg: 'bg-[#DDE6DF] text-[#233829] border-[#B8CBBF]',
    icon: Sparkles,
    label: 'Possible Match',
  },
  Resolved: {
    bg: 'bg-[#EAE9E4] text-[#484A47] border-[#D4D2C9]',
    icon: CheckCircle2,
    label: 'Resolved',
  },
  Archived: {
    bg: 'bg-[#EFEee9] text-[#6E6D68] border-[#DCDAD0]',
    icon: Archive,
    label: 'Archived',
  },
  Pending: {
    bg: 'bg-[#EFECE4] text-[#5C533B] border-[#DDD6C5]',
    icon: Clock,
    label: 'Pending Review',
  },
  'More Information Required': {
    bg: 'bg-[#EFECE4] text-[#5C533B] border-[#DDD6C5]',
    icon: HelpCircle,
    label: 'More Info Requested',
  },
  Rejected: {
    bg: 'bg-[#F0E6E4] text-[#693B34] border-[#DFC9C5]',
    icon: ShieldAlert,
    label: 'Declined',
  },
  'Handed Over': {
    bg: 'bg-[#DDE6DF] text-[#233829] border-[#B8CBBF]',
    icon: PackageCheck,
    label: 'Handed Over',
  },
  'High Potential Match': {
    bg: 'bg-[#DDE6DF] text-[#233829] border-[#B8CBBF]',
    icon: Sparkles,
    label: 'High Match',
  },
};

export default function StatusChip({ status, customLabel, size = 'sm' }) {
  const cfg = STATUS_STYLES[status] || {
    bg: 'bg-[#EAE9E4] text-[#3D443E] border-[#D5D3CA]',
    icon: Clock,
    label: status || 'Unknown',
  };
  const Icon = cfg.icon;

  const sizeClass =
    size === 'xs'
      ? 'px-2.5 py-0.5 text-[11px] gap-1'
      : 'px-3 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${cfg.bg} ${sizeClass}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{customLabel || cfg.label}</span>
    </span>
  );
}
