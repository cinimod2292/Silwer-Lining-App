import { useState, useEffect } from "react";
import { Calendar, Link2, RefreshCw, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CalendarSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  
  const [settings, setSettings] = useState({
    apple_calendar_url: "",
    apple_calendar_user: "",
    apple_calendar_password: "",
    sync_enabled: false,
    booking_calendar: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/calendar-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings({
        ...res.data,
        apple_calendar_password: "", // Password is not returned for security
      });
      // If connected, fetch available calendars
      if (res.data.sync_enabled) {
        fetchAvailableCalendars();
      }
    } catch (e) {
      console.error("Failed to fetch calendar settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCalendars = async () => {
    const token = localStorage.getItem("admin_token");
    setLoadingCalendars(true);
    try {
      const res = await axios.get(`${API}/admin/calendars`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAvailableCalendars(res.data.calendars || []);
    } catch (e) {
      console.error("Failed to fetch calendars");
    } finally {
      setLoadingCalendars(false);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("admin_token");
    setSaving(true);
    try {
      await axios.put(`${API}/admin/calendar-settings`, settings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Calendar settings saved");
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    const token = localStorage.getItem("admin_token");
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/admin/calendar/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Sync complete! ${res.data.synced} bookings synced to ${res.data.calendar_name}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to sync calendar");
    } finally {
      setSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    const token = localStorage.getItem("admin_token");
    setTesting(true);
    setConnectionStatus(null);
    try {
      const res = await axios.post(`${API}/admin/calendar/test`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnectionStatus({ success: true, message: res.data.message, calendar: res.data.calendar_name });
      toast.success(res.data.message);
      // Fetch available calendars on successful connection
      fetchAvailableCalendars();
    } catch (e) {
      setConnectionStatus({ success: false, message: e.response?.data?.detail || "Connection failed" });
      toast.error(e.response?.data?.detail || "Failed to connect to Apple Calendar");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="calendar-settings">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">
          Calendar Sync
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Apple Calendar */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Apple Calendar</h2>
              <p className="text-sm text-muted-foreground">2-way sync with iCloud Calendar</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-warm-sand rounded-lg">
              <div>
                <p className="font-medium">Enable Sync</p>
                <p className="text-xs text-muted-foreground">Automatically sync bookings with Apple Calendar</p>
              </div>
              <Switch
                checked={settings.sync_enabled}
                onCheckedChange={(v) => setSettings((prev) => ({ ...prev, sync_enabled: v }))}
                data-testid="sync-enabled"
              />
            </div>

            <div>
              <Label className="mb-2 block">Apple ID / iCloud Email</Label>
              <Input
                type="email"
                placeholder="your@icloud.com"
                value={settings.apple_calendar_user}
                onChange={(e) => setSettings((prev) => ({ ...prev, apple_calendar_user: e.target.value }))}
                data-testid="input-apple-user"
              />
            </div>

            <div>
              <Label className="mb-2 block">App-Specific Password</Label>
              <Input
                type="password"
                placeholder="Enter app-specific password"
                value={settings.apple_calendar_password}
                onChange={(e) => setSettings((prev) => ({ ...prev, apple_calendar_password: e.target.value }))}
                data-testid="input-apple-password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Create at: appleid.apple.com → Sign-In and Security → App-Specific Passwords
              </p>
            </div>

            <div>
              <Label className="mb-2 block">CalDAV URL (Optional)</Label>
              <Input
                placeholder="https://caldav.icloud.com"
                value={settings.apple_calendar_url}
                onChange={(e) => setSettings((prev) => ({ ...prev, apple_calendar_url: e.target.value }))}
                data-testid="input-caldav-url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default: https://caldav.icloud.com
              </p>
            </div>

            {/* Test Connection Button */}
            <Button
              onClick={handleTestConnection}
              disabled={testing || !settings.apple_calendar_user}
              variant="outline"
              className="w-full gap-2 mt-4"
              data-testid="test-connection-btn"
            >
              <Link2 className={`w-4 h-4 ${testing ? "animate-pulse" : ""}`} />
              {testing ? "Testing..." : "Test Connection"}
            </Button>

            {connectionStatus && (
              <div className={`mt-3 p-3 rounded-lg ${connectionStatus.success ? "bg-green-50" : "bg-red-50"}`}>
                <p className={`text-sm ${connectionStatus.success ? "text-green-700" : "text-red-700"}`}>
                  {connectionStatus.message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sync Status & Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-soft p-6">
            <h3 className="font-semibold mb-4">Sync Status</h3>
            
            {settings.sync_enabled ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <Check className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-700">Sync Enabled</p>
                  <p className="text-sm text-green-600">Calendar will sync automatically</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-700">Sync Disabled</p>
                  <p className="text-sm text-yellow-600">Enable sync to connect your calendar</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleSync}
                disabled={!settings.sync_enabled || syncing}
                variant="outline"
                className="gap-2"
                data-testid="sync-now-btn"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-soft p-6">
            <h3 className="font-semibold mb-4">How It Works</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs flex-shrink-0">1</span>
                <span>New bookings automatically create calendar events</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs flex-shrink-0">2</span>
                <span>Rescheduled bookings update the calendar event</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs flex-shrink-0">3</span>
                <span>Cancelled bookings remove the calendar event</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs flex-shrink-0">4</span>
                <span>Events blocked in your calendar show as unavailable</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary/90 text-white"
            data-testid="save-calendar-settings"
          >
            {saving ? "Saving..." : "Save Calendar Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CalendarSettingsPage;
