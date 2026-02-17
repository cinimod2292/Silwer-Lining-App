import { useState, useEffect } from "react";
import { Calendar, Clock, Settings, Plus, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const daysOfWeek = [
  { id: 0, name: "Sunday", short: "Sun" },
  { id: 1, name: "Monday", short: "Mon" },
  { id: 2, name: "Tuesday", short: "Tue" },
  { id: 3, name: "Wednesday", short: "Wed" },
  { id: 4, name: "Thursday", short: "Thu" },
  { id: 5, name: "Friday", short: "Fri" },
  { id: 6, name: "Saturday", short: "Sat" },
];

const BookingSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState("");
  const [newBlockedDate, setNewBlockedDate] = useState("");
  
  const [settings, setSettings] = useState({
    available_days: [1, 2, 3, 4, 5],
    time_slots: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
    buffer_minutes: 30,
    min_lead_days: 3,
    max_advance_days: 90,
    blocked_dates: [],
    weekend_surcharge: 500,
    session_duration_default: 120,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/booking-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings(res.data);
    } catch (e) {
      console.error("Failed to fetch settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("admin_token");
    setSaving(true);
    try {
      await axios.put(`${API}/admin/booking-settings`, settings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Settings saved successfully");
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayId) => {
    setSettings((prev) => ({
      ...prev,
      available_days: prev.available_days.includes(dayId)
        ? prev.available_days.filter((d) => d !== dayId)
        : [...prev.available_days, dayId].sort(),
    }));
  };

  const addTimeSlot = () => {
    if (newTimeSlot && !settings.time_slots.includes(newTimeSlot)) {
      setSettings((prev) => ({
        ...prev,
        time_slots: [...prev.time_slots, newTimeSlot].sort(),
      }));
      setNewTimeSlot("");
    }
  };

  const removeTimeSlot = (slot) => {
    setSettings((prev) => ({
      ...prev,
      time_slots: prev.time_slots.filter((s) => s !== slot),
    }));
  };

  const addBlockedDate = () => {
    if (newBlockedDate && !settings.blocked_dates.includes(newBlockedDate)) {
      setSettings((prev) => ({
        ...prev,
        blocked_dates: [...prev.blocked_dates, newBlockedDate].sort(),
      }));
      setNewBlockedDate("");
    }
  };

  const removeBlockedDate = (date) => {
    setSettings((prev) => ({
      ...prev,
      blocked_dates: prev.blocked_dates.filter((d) => d !== date),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="booking-settings">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">
          Booking Settings
        </h1>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
          data-testid="save-settings-btn"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Days */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Available Days</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Select days when you accept bookings
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {daysOfWeek.map((day) => (
              <button
                key={day.id}
                onClick={() => toggleDay(day.id)}
                className={`p-3 rounded-lg text-center transition-colors ${
                  settings.available_days.includes(day.id)
                    ? "bg-primary text-white"
                    : "bg-warm-sand text-foreground hover:bg-warm-sand/80"
                }`}
                data-testid={`day-${day.id}`}
              >
                <span className="text-xs font-medium">{day.short}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Slots */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Time Slots</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Available booking times
          </p>
          <div className="flex gap-2 mb-4">
            <Input
              type="time"
              value={newTimeSlot}
              onChange={(e) => setNewTimeSlot(e.target.value)}
              className="w-32"
              data-testid="input-time-slot"
            />
            <Button onClick={addTimeSlot} variant="outline" size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {settings.time_slots.map((slot) => (
              <span
                key={slot}
                className="bg-warm-sand px-3 py-1.5 rounded-full text-sm flex items-center gap-2"
              >
                {slot}
                <button
                  onClick={() => removeTimeSlot(slot)}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Booking Rules */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Booking Rules</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Minimum Lead Time (days)</Label>
              <Input
                type="number"
                value={settings.min_lead_days}
                onChange={(e) => setSettings((prev) => ({ ...prev, min_lead_days: parseInt(e.target.value) || 0 }))}
                className="w-32"
                data-testid="input-min-lead"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Clients must book at least this many days in advance
              </p>
            </div>
            
            <div>
              <Label className="mb-2 block">Maximum Advance Booking (days)</Label>
              <Input
                type="number"
                value={settings.max_advance_days}
                onChange={(e) => setSettings((prev) => ({ ...prev, max_advance_days: parseInt(e.target.value) || 90 }))}
                className="w-32"
                data-testid="input-max-advance"
              />
              <p className="text-xs text-muted-foreground mt-1">
                How far in advance clients can book
              </p>
            </div>
            
            <div>
              <Label className="mb-2 block">Buffer Between Sessions (minutes)</Label>
              <Input
                type="number"
                value={settings.buffer_minutes}
                onChange={(e) => setSettings((prev) => ({ ...prev, buffer_minutes: parseInt(e.target.value) || 0 }))}
                className="w-32"
                data-testid="input-buffer"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Time gap between consecutive sessions
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Rules */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Pricing Rules</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Weekend Surcharge (ZAR)</Label>
              <Input
                type="number"
                value={settings.weekend_surcharge}
                onChange={(e) => setSettings((prev) => ({ ...prev, weekend_surcharge: parseInt(e.target.value) || 0 }))}
                className="w-32"
                data-testid="input-weekend-surcharge"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Additional fee for weekend bookings
              </p>
            </div>
            
            <div>
              <Label className="mb-2 block">Default Session Duration (minutes)</Label>
              <Input
                type="number"
                value={settings.session_duration_default}
                onChange={(e) => setSettings((prev) => ({ ...prev, session_duration_default: parseInt(e.target.value) || 120 }))}
                className="w-32"
                data-testid="input-duration"
              />
            </div>
          </div>
        </div>

        {/* Blocked Dates */}
        <div className="bg-white rounded-xl shadow-soft p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Blocked Dates</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Specific dates when bookings are not available (holidays, personal time, etc.)
          </p>
          <div className="flex gap-2 mb-4">
            <Input
              type="date"
              value={newBlockedDate}
              onChange={(e) => setNewBlockedDate(e.target.value)}
              className="w-48"
              data-testid="input-blocked-date"
            />
            <Button onClick={addBlockedDate} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Block Date
            </Button>
          </div>
          {settings.blocked_dates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {settings.blocked_dates.map((date) => (
                <span
                  key={date}
                  className="bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-sm flex items-center gap-2"
                >
                  {new Date(date).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  <button
                    onClick={() => removeBlockedDate(date)}
                    className="hover:text-red-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No blocked dates</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingSettingsPage;
