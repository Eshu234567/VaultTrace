import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function NotificationsPage() {
  const { refreshUnread, showToast } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/notifications');
      setNotifications(res.data?.notifications || []);
      await refreshUnread();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [refreshUnread]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markRead = async (id) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      loadNotifications();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' });
      showToast('All notifications marked as read');
      loadNotifications();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2621]">Notifications</h1>
          <p className="text-xs text-[#606861]">
            Updates for candidate matches, claim verification decisions, and retention alerts.
          </p>
        </div>

        <button
          onClick={markAllRead}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#D5D3C8] bg-[#FBFBF9] hover:bg-[#E2E0D6] text-xs font-semibold text-[#1F2621] transition"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Mark All Read</span>
        </button>
      </div>

      {loading ? (
        <div className="h-48 bg-[#ECEAE3] rounded-[24px] border border-[#DFDDD4] animate-pulse" />
      ) : notifications.length === 0 ? (
        <div className="bg-[#ECEAE3] rounded-[28px] border border-[#DFDDD4] p-12 text-center space-y-2">
          <Bell className="w-8 h-8 text-[#687069] mx-auto" />
          <h3 className="text-sm font-bold text-[#1F2621]">No notifications yet</h3>
          <p className="text-xs text-[#606861]">
            When a matching item is registered or a claim is reviewed, updates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isUnread = !n.readAt;
            return (
              <div
                key={n._id}
                className={`rounded-[24px] border p-5 transition flex items-start justify-between gap-4 ${
                  isUnread
                    ? 'bg-[#ECEAE3] border-[#C5C3B8]'
                    : 'bg-[#F7F6F2] border-[#DFDDD4] opacity-85'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#2C372F] text-[#F7F6F2] flex items-center justify-center shrink-0 mt-0.5">
                    {n.type === 'MATCH_FOUND' ? (
                      <Sparkles className="w-4 h-4" />
                    ) : n.type === 'RETENTION_ALERT' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-[#FBFBF9] border border-[#DFDDD4] text-[#353D37] font-semibold">
                        {n.type.replace(/_/g, ' ')}
                      </span>
                      {isUnread && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#2C372F] text-[#F7F6F2]">
                          Unread
                        </span>
                      )}
                      <span className="text-[11px] text-[#687069]">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-[#1F2621]">{n.title}</h3>
                    <p className="text-xs text-[#58605A] leading-relaxed">{n.message}</p>

                    <div className="pt-1.5 flex items-center gap-4">
                      <Link
                        to="/my-activity"
                        className="text-xs font-semibold text-[#1F2621] underline underline-offset-4"
                      >
                        Open Claim Inventory
                      </Link>
                      {isUnread && (
                        <button
                          onClick={() => markRead(n._id)}
                          className="text-xs text-[#606861] hover:text-[#1F2621]"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
