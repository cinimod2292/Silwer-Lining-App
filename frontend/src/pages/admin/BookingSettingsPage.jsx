import { useState, useEffect } from "react";
import { Calendar, Clock, Settings, Plus, X, Save, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

const sessionTypes = [
  { id: "maternity", name: "Maternity", color: "bg-pink-100 text-pink-700" },
  { id: "newborn", name: "Newborn", color: "bg-blue-100 text-blue-700" },
  { id: "studio", name: "Studio Portraits", color: "bg-purple-100 text-purple-700" },
  { id: "family", name: "Family", color: "bg-green-100 text-green-700" },
  { id: "baby-birthday", name: "Baby Birthday", color: "bg-yellow-100 text-yellow-700" },
  { id: "adult-birthday", name: "Adult Birthday", color: "bg-orange-100 text-orange-700" },
  { id: "brand-product", name: "Brand/Product", color: "bg-gray-100 text-gray-700" },
];

const BookingSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [activeSessionType, setActiveSessionType] = useState("maternity");
  const [expandedDays, setExpandedDays] = useState({});
  
  // Copy to days modal
  const [showCopyToDaysModal, setShowCopyToDaysModal] = useState(false);
  const [copyFromDay, setCopyFromDay] = useState(null);
  const [selectedCopyDays, setSelectedCopyDays] = useState([]);
  
  // Copy to session type modal
  const [showCopyToSessionModal, setShowCopyToSessionModal] = useState(false);
  const [copyFromSessionDay, setCopyFromSessionDay] = useState(null);
  const [selectedCopySession, setSelectedCopySession] = useState("");
  
  // Time slot schedule: { sessionType: { dayId: ["09:00", "13:00"], ... }, ... }
  const [timeSlotSchedule, setTimeSlotSchedule] = useState({});
  
  // New time slot input per session type per day
  const [newSlotInputs, setNewSlotInputs] = useState({});
  
  const [settings, setSettings] = useState({
    buffer_minutes: 30,
    min_lead_days: 3,
    max_advance_days: 90,
    blocked_dates: [],
    weekend_surcharge: 750,
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
      
      const data = res.data;
      
      // Extract time_slot_schedule from response or initialize empty
      const schedule = data.time_slot_schedule || {};
      setTimeSlotSchedule(schedule);
      
      // Set other settings
      setSettings({
        available_days: data.available_days || [1, 2, 3, 4, 5, 6],
        buffer_minutes: data.buffer_minutes || 30,
        min_lead_days: data.min_lead_days || 3,
        max_advance_days: data.max_advance_days || 90,
        blocked_dates: data.blocked_dates || [],
        weekend_surcharge: data.weekend_surcharge || 750,
        session_duration_default: data.session_duration_default || 120,
      });
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
      const payload = {
        ...settings,
        time_slot_schedule: timeSlotSchedule,
      };
      
      await axios.put(`${API}/admin/booking-settings`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Settings saved successfully");
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getTimeSlotsForDay = (sessionType, dayId) => {
    return timeSlotSchedule[sessionType]?.[dayId] || [];
  };

  const addTimeSlot = (sessionType, dayId) => {
    const inputKey = `${sessionType}-${dayId}`;
    const newSlot = newSlotInputs[inputKey];
    
    if (!newSlot) return;
    
    const currentSlots = getTimeSlotsForDay(sessionType, dayId);
    if (currentSlots.includes(newSlot)) {
      toast.error("This time slot already exists");
      return;
    }
    
    setTimeSlotSchedule((prev) => ({
      ...prev,
      [sessionType]: {
        ...prev[sessionType],
        [dayId]: [...currentSlots, newSlot].sort(),
      },
    }));
    
    // Clear input
    setNewSlotInputs((prev) => ({ ...prev, [inputKey]: "" }));
  };

  const removeTimeSlot = (sessionType, dayId, slot) => {
    const currentSlots = getTimeSlotsForDay(sessionType, dayId);
    setTimeSlotSchedule((prev) => ({
      ...prev,
      [sessionType]: {
        ...prev[sessionType],
        [dayId]: currentSlots.filter((s) => s !== slot),
      },
    }));
  };

  const openCopyToDaysModal = (dayId) => {
    const slots = getTimeSlotsForDay(activeSessionType, dayId);
    if (slots.length === 0) {
      toast.error("No time slots to copy");
      return;
    }
    setCopyFromDay(dayId);
    // Pre-select all days except the source day
    setSelectedCopyDays(daysOfWeek.map(d => d.id).filter(d => d !== dayId));
    setShowCopyToDaysModal(true);
  };

  const handleCopyToDays = () => {
    if (selectedCopyDays.length === 0) {
      toast.error("Please select at least one day");
      return;
    }
    
    const slots = getTimeSlotsForDay(activeSessionType, copyFromDay);
    const newSchedule = { ...timeSlotSchedule };
    
    if (!newSchedule[activeSessionType]) {
      newSchedule[activeSessionType] = {};
    }
    
    selectedCopyDays.forEach((dayId) => {
      newSchedule[activeSessionType][dayId] = [...slots];
    });
    
    setTimeSlotSchedule(newSchedule);
    setShowCopyToDaysModal(false);
    toast.success(`Copied ${slots.length} slots to ${selectedCopyDays.length} day(s)`);
  };

  const toggleCopyDay = (dayId) => {
    setSelectedCopyDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId]
    );
  };

  const openCopyToSessionModal = (dayId) => {
    const slots = getTimeSlotsForDay(activeSessionType, dayId);
    if (slots.length === 0) {
      toast.error("No time slots to copy");
      return;
    }
    setCopyFromSessionDay(dayId);
    setSelectedCopySession("");
    setShowCopyToSessionModal(true);
  };

  const handleCopyToSession = () => {
    if (!selectedCopySession) {
      toast.error("Please select a session type");
      return;
    }
    
    const slots = getTimeSlotsForDay(activeSessionType, copyFromSessionDay);
    const newSchedule = { ...timeSlotSchedule };
    
    if (!newSchedule[selectedCopySession]) {
      newSchedule[selectedCopySession] = {};
    }
    
    // Copy to the same day in the target session type
    newSchedule[selectedCopySession][copyFromSessionDay] = [...slots];
    
    setTimeSlotSchedule(newSchedule);
    setShowCopyToSessionModal(false);
    
    const targetName = sessionTypes.find(s => s.id === selectedCopySession)?.name;
    const dayName = daysOfWeek.find(d => d.id === copyFromSessionDay)?.name;
    toast.success(`Copied ${slots.length} slots to ${targetName} (${dayName})`);
  };

  const toggleDayExpanded = (dayId) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayId]: !prev[dayId],
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

  const getTotalSlots = (sessionType) => {
    const schedule = timeSlotSchedule[sessionType];
    if (!schedule) return 0;
    return Object.values(schedule).reduce((sum, slots) => sum + (slots?.length || 0), 0);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Booking Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure availability per session type and day
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
          data-testid="save-settings-btn"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>

      {/* Time Slots by Session Type */}
      <div className="bg-white rounded-xl shadow-soft p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg">Time Slots by Session Type</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Configure different time slots for each session type and day. This allows maximum flexibility for your schedule.
        </p>

        <Tabs value={activeSessionType} onValueChange={setActiveSessionType}>
          <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0 mb-6">
            {sessionTypes.map((type) => {
              const totalSlots = getTotalSlots(type.id);
              return (
                <TabsTrigger
                  key={type.id}
                  value={type.id}
                  className={`px-4 py-2 rounded-lg border-2 transition-all data-[state=active]:border-primary data-[state=active]:bg-primary/5 ${type.color.replace('text-', 'data-[state=active]:text-')}`}
                  data-testid={`tab-${type.id}`}
                >
                  <span>{type.name}</span>
                  {totalSlots > 0 && (
                    <span className="ml-2 bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                      {totalSlots}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {sessionTypes.map((type) => (
            <TabsContent key={type.id} value={type.id} className="mt-0">
              <div className="space-y-3">
                {daysOfWeek.map((day) => {
                  const slots = getTimeSlotsForDay(type.id, day.id);
                  const isAvailable = settings.available_days.includes(day.id);
                  const inputKey = `${type.id}-${day.id}`;
                  
                  return (
                    <Collapsible
                      key={day.id}
                      open={expandedDays[day.id]}
                      onOpenChange={() => toggleDayExpanded(day.id)}
                    >
                      <div className={`border rounded-lg ${!isAvailable ? 'opacity-50' : ''}`}>
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-4 hover:bg-warm-sand/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${
                                isAvailable ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {day.short}
                              </span>
                              <div className="text-left">
                                <p className="font-medium">{day.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {!isAvailable 
                                    ? "Not available" 
                                    : slots.length > 0 
                                      ? `${slots.length} time slot${slots.length > 1 ? 's' : ''}: ${slots.join(', ')}`
                                      : "No time slots configured"
                                  }
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {slots.length > 0 && (
                                <div className="flex gap-1">
                                  {slots.slice(0, 3).map((slot) => (
                                    <span key={slot} className={`text-xs px-2 py-1 rounded ${type.color}`}>
                                      {slot}
                                    </span>
                                  ))}
                                  {slots.length > 3 && (
                                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                                      +{slots.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                              {expandedDays[day.id] ? (
                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          {isAvailable && (
                            <div className="px-4 pb-4 pt-2 border-t bg-warm-sand/20">
                              <div className="flex flex-wrap gap-2 mb-4">
                                {slots.map((slot) => (
                                  <span
                                    key={slot}
                                    className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-2 ${type.color}`}
                                  >
                                    {slot}
                                    <button
                                      onClick={() => removeTimeSlot(type.id, day.id, slot)}
                                      className="hover:text-red-600"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                                {slots.length === 0 && (
                                  <span className="text-sm text-muted-foreground italic">
                                    No time slots for {day.name}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  type="time"
                                  value={newSlotInputs[inputKey] || ""}
                                  onChange={(e) => setNewSlotInputs((prev) => ({ 
                                    ...prev, 
                                    [inputKey]: e.target.value 
                                  }))}
                                  className="w-32"
                                  data-testid={`input-time-${type.id}-${day.id}`}
                                />
                                <Button 
                                  onClick={() => addTimeSlot(type.id, day.id)} 
                                  variant="outline" 
                                  size="sm"
                                  data-testid={`add-slot-${type.id}-${day.id}`}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add Slot
                                </Button>
                                {slots.length > 0 && (
                                  <>
                                    <Button
                                      onClick={() => openCopyToDaysModal(day.id)}
                                      variant="ghost"
                                      size="sm"
                                      className="text-muted-foreground gap-1"
                                    >
                                      <Copy className="w-3 h-3" />
                                      Copy to days...
                                    </Button>
                                    <Button
                                      onClick={() => openCopyToSessionModal(day.id)}
                                      variant="ghost"
                                      size="sm"
                                      className="text-muted-foreground gap-1"
                                    >
                                      <Copy className="w-3 h-3" />
                                      Copy to session...
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                How many days in advance clients must book
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
                How far in the future clients can book
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
                Time between consecutive bookings
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
                Additional fee for Saturday/Sunday bookings
              </p>
            </div>
          </div>
        </div>

        {/* Blocked Dates */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Blocked Dates</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Dates when bookings are not available
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
              Block
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

      {/* Copy to Days Modal */}
      <Dialog open={showCopyToDaysModal} onOpenChange={setShowCopyToDaysModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy Time Slots to Days</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copying from <strong>{daysOfWeek.find(d => d.id === copyFromDay)?.name}</strong> ({getTimeSlotsForDay(activeSessionType, copyFromDay).length} slots)
            </p>
            
            <div className="space-y-2">
              <Label>Select days to copy to:</Label>
              <div className="grid grid-cols-2 gap-2">
                {daysOfWeek.filter(d => d.id !== copyFromDay).map((day) => (
                  <div key={day.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`copy-day-${day.id}`}
                      checked={selectedCopyDays.includes(day.id)}
                      onCheckedChange={() => toggleCopyDay(day.id)}
                    />
                    <Label htmlFor={`copy-day-${day.id}`} className="font-normal cursor-pointer">
                      {day.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCopyDays(daysOfWeek.map(d => d.id).filter(d => d !== copyFromDay))}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCopyDays([])}
              >
                Clear
              </Button>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyToDaysModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCopyToDays} disabled={selectedCopyDays.length === 0}>
              Copy to {selectedCopyDays.length} Day(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy to Session Type Modal */}
      <Dialog open={showCopyToSessionModal} onOpenChange={setShowCopyToSessionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy Time Slots to Session Type</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copying <strong>{daysOfWeek.find(d => d.id === copyFromSessionDay)?.name}</strong> slots from <strong>{sessionTypes.find(s => s.id === activeSessionType)?.name}</strong>
            </p>
            
            <div className="space-y-2">
              <Label>Select target session type:</Label>
              <Select value={selectedCopySession} onValueChange={setSelectedCopySession}>
                <SelectTrigger>
                  <SelectValue placeholder="Select session type" />
                </SelectTrigger>
                <SelectContent>
                  {sessionTypes.filter(s => s.id !== activeSessionType).map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <p className="text-xs text-muted-foreground">
              This will copy the time slots for {daysOfWeek.find(d => d.id === copyFromSessionDay)?.name} to the selected session type.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyToSessionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCopyToSession} disabled={!selectedCopySession}>
              Copy Slots
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingSettingsPage;
