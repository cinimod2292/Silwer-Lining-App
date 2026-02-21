import { useState, useEffect } from "react";
import { Mail, Save, Send, Check, AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const EmailSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  
  const [settings, setSettings] = useState({
    provider: "sendgrid", // sendgrid or microsoft
    // SendGrid
    sendgrid_api_key: "",
    sendgrid_sender_email: "",
    sendgrid_sender_name: "Silwer Lining Photography",
    // Microsoft Graph
    microsoft_tenant_id: "",
    microsoft_client_id: "",
    microsoft_client_secret: "",
    microsoft_sender_email: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/email-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (e) {
      // Settings don't exist yet
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("admin_token");
    setSaving(true);
    try {
      await axios.put(`${API}/admin/email-settings`, settings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Email settings saved");
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast.error("Enter a test email address");
      return;
    }
    
    const token = localStorage.getItem("admin_token");
    setTesting(true);
    try {
      const res = await axios.post(`${API}/admin/email-settings/test`, 
        { email: testEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || "Test email sent!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to send test email");
    } finally {
      setTesting(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Email Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure email provider for sending booking confirmations and reminders
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-primary text-white">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Provider Selection */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <h2 className="font-semibold text-lg mb-4">Email Provider</h2>
          <RadioGroup
            value={settings.provider}
            onValueChange={(v) => handleChange("provider", v)}
            className="space-y-3"
          >
            <div className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              settings.provider === "microsoft" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
            }`}>
              <RadioGroupItem value="microsoft" id="microsoft" />
              <Label htmlFor="microsoft" className="flex-1 cursor-pointer">
                <span className="font-medium">Microsoft 365 (Graph API)</span>
                <span className="block text-sm text-muted-foreground">Send from your Microsoft 365 mailbox</span>
              </Label>
              {settings.provider === "microsoft" && <Check className="w-5 h-5 text-primary" />}
            </div>
            
            <div className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              settings.provider === "sendgrid" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
            }`}>
              <RadioGroupItem value="sendgrid" id="sendgrid" />
              <Label htmlFor="sendgrid" className="flex-1 cursor-pointer">
                <span className="font-medium">SendGrid</span>
                <span className="block text-sm text-muted-foreground">Reliable email delivery service (backup)</span>
              </Label>
              {settings.provider === "sendgrid" && <Check className="w-5 h-5 text-primary" />}
            </div>
          </RadioGroup>
        </div>

        {/* Microsoft Graph Settings */}
        {settings.provider === "microsoft" && (
          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 23 23" fill="none">
                  <path d="M11 11H0V0h11v11z" fill="#f25022"/>
                  <path d="M23 11H12V0h11v11z" fill="#7fba00"/>
                  <path d="M11 23H0V12h11v11z" fill="#00a4ef"/>
                  <path d="M23 23H12V12h11v11z" fill="#ffb900"/>
                </svg>
              </div>
              <div>
                <h2 className="font-semibold">Microsoft 365 Configuration</h2>
                <p className="text-xs text-muted-foreground">From Azure App Registration</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Directory (Tenant) ID *</Label>
                <Input
                  value={settings.microsoft_tenant_id}
                  onChange={(e) => handleChange("microsoft_tenant_id", e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>
              <div>
                <Label>Application (Client) ID *</Label>
                <Input
                  value={settings.microsoft_client_id}
                  onChange={(e) => handleChange("microsoft_client_id", e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>
              <div>
                <Label>Client Secret *</Label>
                <Input
                  type="password"
                  value={settings.microsoft_client_secret}
                  onChange={(e) => handleChange("microsoft_client_secret", e.target.value)}
                  placeholder="Your client secret value"
                />
              </div>
              <div>
                <Label>Sender Email (Microsoft 365 mailbox) *</Label>
                <Input
                  type="email"
                  value={settings.microsoft_sender_email}
                  onChange={(e) => handleChange("microsoft_sender_email", e.target.value)}
                  placeholder="info@silwerlining.co.za"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Must be a valid Microsoft 365 mailbox in your tenant
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Setup Guide:</strong> Azure Portal → Azure AD → App registrations → New → 
                Add <code className="bg-blue-100 px-1 rounded">Mail.Send</code> application permission → Grant admin consent
              </p>
            </div>
          </div>
        )}

        {/* SendGrid Settings */}
        {settings.provider === "sendgrid" && (
          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold">SendGrid Configuration</h2>
                <p className="text-xs text-muted-foreground">Email delivery service</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>API Key *</Label>
                <Input
                  type="password"
                  value={settings.sendgrid_api_key}
                  onChange={(e) => handleChange("sendgrid_api_key", e.target.value)}
                  placeholder="SG.xxxxx..."
                />
              </div>
              <div>
                <Label>Sender Email *</Label>
                <Input
                  type="email"
                  value={settings.sendgrid_sender_email}
                  onChange={(e) => handleChange("sendgrid_sender_email", e.target.value)}
                  placeholder="noreply@silwerlining.co.za"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Must be verified in SendGrid
                </p>
              </div>
              <div>
                <Label>Sender Name</Label>
                <Input
                  value={settings.sendgrid_sender_name}
                  onChange={(e) => handleChange("sendgrid_sender_name", e.target.value)}
                  placeholder="Silwer Lining Photography"
                />
              </div>
            </div>
          </div>
        )}

        {/* Test Email */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <h2 className="font-semibold text-lg mb-4">Test Email</h2>
          <div className="flex gap-3">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter email to test"
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={testing} variant="outline">
              <Send className="w-4 h-4 mr-2" />
              {testing ? "Sending..." : "Send Test"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Save settings first, then send a test email to verify configuration
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailSettingsPage;
