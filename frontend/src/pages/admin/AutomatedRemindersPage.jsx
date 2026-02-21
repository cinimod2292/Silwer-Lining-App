import { useState, useEffect } from "react";
import { Clock, Mail, Plus, Trash2, Save, Play, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const TRIGGER_OPTIONS = [
  { value: "days_before_session", label: "Days before session" },
  { value: "days_after_booking", label: "Days after booking" },
  { value: "questionnaire_incomplete", label: "Questionnaire not completed" },
  { value: "payment_pending", label: "Payment pending" },
];

const DEFAULT_TEMPLATES = {
  questionnaire_reminder: {
    name: "Questionnaire Reminder",
    trigger_type: "days_before_session",
    trigger_days: 3,
    condition: "questionnaire_incomplete",
    subject: "Reminder: Complete Your Session Questionnaire",
    body: `Hi {{client_name}},

Your {{session_type}} session is coming up on {{booking_date}}!

Please complete your questionnaire to help us prepare for your session.

Click here to complete: {{manage_link}}

Looking forward to seeing you!

Warm regards,
Silwer Lining Photography`
  },
  payment_reminder: {
    name: "Payment Reminder", 
    trigger_type: "days_after_booking",
    trigger_days: 2,
    condition: "payment_pending",
    subject: "Payment Reminder - {{session_type}} Session",
    body: `Hi {{client_name}},

This is a friendly reminder that your payment for the {{session_type}} session is still pending.

Session Date: {{booking_date}}
Amount Due: R{{amount_due}}

Click here to complete payment: {{payment_link}}

If you have any questions, please don't hesitate to reach out.

Warm regards,
Silwer Lining Photography`
  },
  session_reminder: {
    name: "Session Reminder",
    trigger_type: "days_before_session",
    trigger_days: 1,
    condition: "",
    subject: "Tomorrow: Your {{session_type}} Session",
    body: `Hi {{client_name}},

Just a reminder that your {{session_type}} session is tomorrow!

Date: {{booking_date}}
Time: {{booking_time}}
Location: Helderkruin, Roodepoort

What to bring:
- Outfit changes (if applicable)
- Props you'd like to include
- Good vibes! ✨

See you soon!

Warm regards,
Nadia
Silwer Lining Photography`
  }
};

const AutomatedRemindersPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/automated-reminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReminders(res.data || []);
    } catch (e) {
      // Initialize with defaults if none exist
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("admin_token");
    setSaving(true);
    try {
      await axios.put(`${API}/admin/automated-reminders`, { reminders }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Reminders saved successfully");
      setEditingId(null);
    } catch (e) {
      toast.error("Failed to save reminders");
    } finally {
      setSaving(false);
    }
  };

  const addReminder = (templateKey) => {
    const template = DEFAULT_TEMPLATES[templateKey] || {
      name: "New Reminder",
      trigger_type: "days_before_session",
      trigger_days: 1,
      condition: "",
      subject: "",
      body: "",
      active: true
    };
    
    const newReminder = {
      id: `reminder_${Date.now()}`,
      ...template,
      active: true
    };
    setReminders([...reminders, newReminder]);
    setEditingId(newReminder.id);
  };

  const updateReminder = (id, field, value) => {
    setReminders(reminders.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const deleteReminder = (id) => {
    setReminders(reminders.filter(r => r.id !== id));
  };

  const runNow = async (reminder) => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.post(`${API}/admin/run-reminder`, { reminder_id: reminder.id }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Sent ${res.data.sent_count || 0} reminder(s)`);
    } catch (e) {
      toast.error("Failed to run reminder");
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
    <div data-testid="automated-reminders">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Automated Reminders</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set up automatic email reminders for clients
          </p>
        </div>
        <div className="flex gap-2">
          <Select onValueChange={addReminder}>
            <SelectTrigger className="w-[180px]">
              <Plus className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Add Reminder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="questionnaire_reminder">Questionnaire Reminder</SelectItem>
              <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
              <SelectItem value="session_reminder">Session Reminder</SelectItem>
              <SelectItem value="custom">Custom Reminder</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving} className="bg-primary text-white">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">How it works</p>
            <p className="text-sm text-amber-700">
              Reminders are checked daily. Use variables like <code className="bg-amber-100 px-1 rounded">{"{{client_name}}"}</code>, 
              <code className="bg-amber-100 px-1 rounded">{"{{booking_date}}"}</code>, 
              <code className="bg-amber-100 px-1 rounded">{"{{session_type}}"}</code>, 
              <code className="bg-amber-100 px-1 rounded">{"{{manage_link}}"}</code> in your templates.
            </p>
          </div>
        </div>
      </div>

      {reminders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Reminders Set Up</h3>
          <p className="text-muted-foreground mb-4">Add your first automated reminder to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder) => (
            <div key={reminder.id} className="bg-white rounded-xl shadow-soft overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={reminder.active}
                    onCheckedChange={(checked) => updateReminder(reminder.id, "active", checked)}
                  />
                  <div>
                    <h3 className="font-semibold">{reminder.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {reminder.trigger_days} days {reminder.trigger_type === "days_before_session" ? "before session" : "after booking"}
                      {reminder.condition && ` • ${reminder.condition.replace(/_/g, ' ')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => runNow(reminder)}>
                    <Play className="w-4 h-4 mr-1" /> Run Now
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setEditingId(editingId === reminder.id ? null : reminder.id)}
                  >
                    {editingId === reminder.id ? "Collapse" : "Edit"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteReminder(reminder.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
              
              {editingId === reminder.id && (
                <div className="p-4 bg-gray-50 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Reminder Name</Label>
                      <Input
                        value={reminder.name}
                        onChange={(e) => updateReminder(reminder.id, "name", e.target.value)}
                        placeholder="e.g., Questionnaire Reminder"
                      />
                    </div>
                    <div>
                      <Label>Trigger Type</Label>
                      <Select
                        value={reminder.trigger_type}
                        onValueChange={(val) => updateReminder(reminder.id, "trigger_type", val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRIGGER_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Days</Label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={reminder.trigger_days}
                        onChange={(e) => updateReminder(reminder.id, "trigger_days", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <Label>Condition (Optional)</Label>
                      <Select
                        value={reminder.condition || "none"}
                        onValueChange={(val) => updateReminder(reminder.id, "condition", val === "none" ? "" : val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No condition (send to all)</SelectItem>
                          <SelectItem value="questionnaire_incomplete">Questionnaire not completed</SelectItem>
                          <SelectItem value="payment_pending">Payment pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Email Subject</Label>
                    <Input
                      value={reminder.subject}
                      onChange={(e) => updateReminder(reminder.id, "subject", e.target.value)}
                      placeholder="e.g., Reminder: Complete Your Questionnaire"
                    />
                  </div>
                  
                  <div>
                    <Label>Email Body</Label>
                    <Textarea
                      value={reminder.body}
                      onChange={(e) => updateReminder(reminder.id, "body", e.target.value)}
                      rows={10}
                      placeholder="Use {{client_name}}, {{booking_date}}, {{session_type}}, {{manage_link}}, etc."
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutomatedRemindersPage;
