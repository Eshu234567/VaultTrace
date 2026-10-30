import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { isAdmin, loginAsAdmin, exitAdminMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await loginAsAdmin(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Administrator authentication failed');
    } finally {
      setBusy(false);
    }
  };

  if (isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-[#2C372F] text-[#F7F6F2] flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-[#1F2621]">Administrator Session Active</h1>
          <p className="text-xs text-[#606861]">
            You have full custody, claim verification, and retention approval permissions.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => navigate('/admin')}
            className="w-full py-3 rounded-2xl bg-[#2C372F] text-[#F7F6F2] text-xs font-semibold hover:bg-[#1F2621] transition"
          >
            Open Admin Console
          </button>
          <button
            onClick={async () => {
              await exitAdminMode();
              navigate('/');
            }}
            className="w-full py-3 rounded-2xl bg-[#F7F6F2] text-[#2C372F] border border-[#D8D6CC] text-xs font-semibold hover:bg-[#E2E0D6] transition"
          >
            Sign Out of Admin Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-8">
      <div className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-8 space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#2C372F] text-[#F7F6F2] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1F2621]">Administrator Sign In</h1>
            <p className="text-xs text-[#606861]">
              No login is required for reporting or searching items. Sign in below for custodian moderation.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-[#F0E6E4] border border-[#DFC9C5] text-[#693B34] px-4 py-3 rounded-2xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
              Administrator Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter administrator email"
              className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-4 py-3 text-xs text-[#1F2621] focus:outline-none focus:border-[#2C372F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#353D37] mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-2xl border border-[#D5D3C8] bg-[#FBFBF9] px-4 py-3 text-xs text-[#1F2621] focus:outline-none focus:border-[#2C372F]"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#2C372F] hover:bg-[#1F2621] text-[#F7F6F2] text-xs font-semibold transition"
          >
            <span>{busy ? 'Signing in...' : 'Sign In as Administrator'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
