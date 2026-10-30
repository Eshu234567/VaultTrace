import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutGrid,
  PlusCircle,
  PackagePlus,
  Bell,
  FileText,
  Sliders,
  Database,
  Lock,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AppLayout({ children }) {
  const { isAdmin, unreadCount, exitAdminMode, toast } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleExitAdmin = async () => {
    await exitAdminMode();
    navigate('/');
  };

  const sidebarLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
      isActive
        ? 'bg-[#FBFBF9] text-[#1F2621] shadow-sm font-semibold'
        : 'text-[#525B54] hover:text-[#1F2621] hover:bg-[#FBFBF9]/50'
    }`;

  return (
    <div className="min-h-screen bg-[#E2E1DA] p-0 sm:p-4 md:p-6 flex items-center justify-center">
      {/* Main Soft Rounded App Frame (Smartech / Monochromatic Dashboard Style) */}
      <div className="w-full max-w-[1440px] min-h-[calc(100vh-3rem)] bg-[#F7F6F2] sm:rounded-[32px] shadow-xl border border-[#DFDDD4] flex flex-col lg:flex-row overflow-hidden">
        {/* Left Monochromatic Sidebar */}
        <aside className="w-full lg:w-64 bg-[#ECEAE3] border-b lg:border-b-0 lg:border-r border-[#DFDDD4] p-5 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            {/* Top Brand Header */}
            <div className="flex items-center justify-between px-2">
              <Link to="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#2C372F] text-[#F7F6F2] flex items-center justify-center shadow-sm">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-lg tracking-tight text-[#1F2621] block leading-none">
                    VaultTrace
                  </span>
                  <span className="text-[11px] text-[#687069] font-medium">
                    Recovery Portal
                  </span>
                </div>
              </Link>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-[#2C372F] hover:bg-[#FBFBF9]"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            {/* Active Mode Badge */}
            <div className="px-3 py-3 rounded-2xl bg-[#E2E0D6] border border-[#D5D3C8] flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#2C372F] text-[#F7F6F2] flex items-center justify-center font-bold text-xs shrink-0">
                {isAdmin ? 'AD' : 'CP'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#1F2621] truncate">
                  {isAdmin ? 'Administrator' : 'Campus Portal'}
                </div>
                <div className="text-[11px] text-[#606861] truncate">
                  {isAdmin ? 'Custody and Moderation' : 'Public Recovery Access'}
                </div>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className={`${mobileMenuOpen ? 'block' : 'hidden'} lg:block space-y-1.5`}>
              <NavLink to="/" end onClick={() => setMobileMenuOpen(false)} className={sidebarLinkClass}>
                <LayoutGrid className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink to="/report-lost" onClick={() => setMobileMenuOpen(false)} className={sidebarLinkClass}>
                <PlusCircle className="w-4 h-4" />
                <span>Report Lost Item</span>
              </NavLink>

              <NavLink to="/report-found" onClick={() => setMobileMenuOpen(false)} className={sidebarLinkClass}>
                <PackagePlus className="w-4 h-4" />
                <span>{isAdmin ? 'Intake Found Item' : 'Report Found Item'}</span>
              </NavLink>

              <NavLink to="/my-activity" onClick={() => setMobileMenuOpen(false)} className={sidebarLinkClass}>
                <Shield className="w-4 h-4" />
                <span>Claim</span>
              </NavLink>

              <NavLink to="/notifications" onClick={() => setMobileMenuOpen(false)} className={sidebarLinkClass}>
                <div className="relative">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#2C372F]" />
                  )}
                </div>
                <span className="flex-1">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#2C372F] text-[#F7F6F2]">
                    {unreadCount}
                  </span>
                )}
              </NavLink>

              {isAdmin && (
                <NavLink to="/admin" onClick={() => setMobileMenuOpen(false)} className={sidebarLinkClass}>
                  <Sliders className="w-4 h-4" />
                  <span>Admin Console</span>
                </NavLink>
              )}

              <NavLink to="/dbms-lab" onClick={() => setMobileMenuOpen(false)} className={sidebarLinkClass}>
                <Database className="w-4 h-4" />
                <span>Database Lab</span>
              </NavLink>
            </nav>
          </div>

          {/* Bottom Admin Login / Logout Action */}
          <div className={`${mobileMenuOpen ? 'block mt-4' : 'hidden'} lg:block pt-4 border-t border-[#D8D6CC]`}>
            {isAdmin ? (
              <button
                onClick={handleExitAdmin}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-[#525B54] hover:text-[#1F2621] hover:bg-[#FBFBF9]/60 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Exit Admin Mode</span>
              </button>
            ) : (
              <NavLink
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className={sidebarLinkClass}
              >
                <Lock className="w-4 h-4" />
                <span>Admin Login</span>
              </NavLink>
            )}
          </div>
        </aside>

        {/* Right Main Workspace Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F7F6F2]">
          {/* Subtle Top Bar */}
          <header className="px-6 sm:px-8 pt-6 pb-4 flex items-center justify-between gap-4 border-b border-[#EAE8E0]">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1F2621] uppercase">
                {isAdmin ? 'Vault Administration' : 'Campus Recovery Workspace'}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/notifications"
                className="relative p-2.5 rounded-full bg-[#ECEAE3] text-[#2C372F] hover:bg-[#E2E0D6] transition"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#2C372F] text-[10px] font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Link>

              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <Link
                    to="/admin"
                    className="px-4 py-2 rounded-full bg-[#2C372F] text-[#F7F6F2] text-xs font-semibold hover:bg-[#1F2621] transition"
                  >
                    Admin Console
                  </Link>
                  <button
                    onClick={handleExitAdmin}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#ECEAE3] text-[#2C372F] border border-[#D8D6CC] text-xs font-semibold hover:bg-[#E2E0D6] transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-full bg-[#ECEAE3] text-[#2C372F] border border-[#D8D6CC] text-xs font-semibold hover:bg-[#E2E0D6] transition"
                >
                  Admin Login
                </Link>
              )}
            </div>
          </header>

          {/* Page Content Area */}
          <main className="flex-1 p-6 sm:p-8 overflow-y-auto">{children}</main>
        </div>
      </div>

      {/* Minimal Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-[#2C372F] text-[#F7F6F2] px-5 py-3.5 rounded-2xl shadow-xl border border-[#425046] flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#C8D3C9] shrink-0" />
          <p className="text-xs font-medium">{toast.message}</p>
        </div>
      )}
    </div>
  );
}
