import { useState, useEffect, useCallback } from "react";
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

  /* =========================
     FETCH AVAILABLE CALENDARS
  ========================== */

  const fetchAvailableCalendars = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    setLoadingCalendars(true);

    try {
      const res = await axios.get(`${API}/admin/calendars`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setAvailableCalendars(res.data.calendars || []);
    } catch (e) {
      console.error("Failed to fetch calendars", e);
    } finally {
      setLoadingCalendars(false);
    }
  }, []);

  /* =========================
     FETCH SETTINGS
  ========================== */

  const fetchSettings = useCallback(async () => {
    const token = localStorage.getItem("admin_token");

    try {
      const res = await axios.get(`${API}/admin/calendar-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSettings({
        ...res.data,
        apple_calendar_password: "",
      });

      if (res.data.sync_enabled) {
        fetchAvailableCalendars();
      }
    } catch (e) {
      console.error("Failed to fetch calendar settings", e);
    } finally {
      setLoading(false);
    }
  }, [fetchAvailableCalendars]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  /* =========================
     SAVE SETTINGS
  ========================== */

  const handleSave = useCallback(async () => {
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
  }, [settings]);

  /* =========================
     SYNC NOW
  ========================== */

  const handleSync = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    setSyncing(true);

    try {
      const res = await axios.post(
        `${API}/admin/calendar/sync`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(
        `Sync complete! ${res.data.synced} bookings synced to ${res.data.calendar_name}`
      );
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to sync calendar");
    } finally {
      setSyncing(false);
    }
  }, []);

  /* =========================
     TEST CONNECTION
  ========================== */

  const handleTestConnection = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    setTesting(true);
    setConnectionStatus(null);

    try {
      const res = await axios.post(
        `${API}/admin/calendar/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setConnectionStatus({
        success: true,
        message: res.data.message,
        calendar: res.data.calendar_name,
      });

      toast.success(res.data.message);

      // Refresh calendars after successful connection
      fetchAvailableCalendars();
    } catch (e) {
      const errorMessage =
        e.response?.data?.detail || "Failed to connect to Apple Calendar";

      setConnectionStatus({
        success: false,
        message: errorMessage,
      });

      toast.error(errorMessage);
    } finally {
      setTesting(false);
    }
  }, [fetchAvailableCalendars]);

  /* =========================
     LOADING STATE
  ========================== */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  /* =========================
     UI
  ========================== */

  return (
    <div data-testid="calendar-settings">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">
          Calendar Sync
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Apple Calendar Settings */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Apple Calendar</h2>
              <p className="text-sm text-muted-foreground">
                2-way sync with iCloud Calendar
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-warm-sand rounded-lg">
              <div>
                <p className="font-medium">Enable Sync</p>
                <p className="text-xs text-muted-foreground">
                  Automatically sync bookings with Apple Calendar
                </p>
              </div>
              <Switch
                checked={settings.sync_enabled}
                onCheckedChange={(v) =>
                  setSettings((prev) => ({ ...prev, sync_enabled: v }))
                }
              />
            </div>

            <div>
              <Label className="mb-2 block">Apple ID / iCloud Email</Label>
              <Input
                type="email"
                value={settings.apple_calendar_user}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    apple_calendar_user: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label className="mb-2 block">App-Specific Password</Label>
              <Input
                type="password"
                value={settings.apple_calendar_password}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    apple_calendar_password: e.target.value,
                  }))
                }
              />
            </div>

            {availableCalendars.length > 0 && (
              <div>
                <Label className="mb-2 block">
                  Calendar for New Bookings
                </Label>
                <Select
                  value={settings.booking_calendar}
                  onValueChange={(v) =>
                    setSettings((prev) => ({
                      ...prev,
                      booking_calendar: v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select calendar" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCalendars.map((cal) => (
                      <SelectItem key={cal.name} value={cal.name}>
                        {cal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleTestConnection}
              disabled={testing || !settings.apple_calendar_user}
              variant="outline"
              className="w-full gap-2 mt-4"
            >
              <Link2 className={`w-4 h-4 ${testing ? "animate-pulse" : ""}`} />
              {testing ? "Testing..." : "Test Connection"}
            </Button>

            {connectionStatus && (
              <div
                className={`mt-3 p-3 rounded-lg ${
                  connectionStatus.success ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <p
                  className={`text-sm ${
                    connectionStatus.success
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {connectionStatus.message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-soft p-6">
            <h3 className="font-semibold mb-4">Sync Status</h3>

            {settings.sync_enabled ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <Check className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-700">Sync Enabled</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-700">Sync Disabled</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleSync}
                disabled={!settings.sync_enabled || syncing}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary/90 text-white"
          >
            {saving ? "Saving..." : "Save Calendar Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CalendarSettingsPage;
