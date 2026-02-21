import { useState, useEffect } from "react";
import { Building2, CreditCard, Save, Clock, CheckCircle, AlertTriangle, Shield } from "lucide-react";
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

const PaymentSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    bank_name: "",
    account_holder: "",
    account_number: "",
    branch_code: "",
    account_type: "",
    reference_format: "BOOKING-{booking_id}",
    payflex_api_key: "",
    payflex_enabled: false,
    payfast_enabled: true,
    payfast_sandbox: true,
    payfast_merchant_id: "",
    payfast_merchant_key: "",
    payfast_passphrase: "",
    payfast_sandbox_merchant_id: "",
    payfast_sandbox_merchant_key: "",
    payfast_sandbox_passphrase: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/payment-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (e) {
      console.error("Failed to fetch payment settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("admin_token");
    setSaving(true);
    try {
      await axios.put(`${API}/admin/payment-settings`, settings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Payment settings saved");
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
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
    <div data-testid="payment-settings">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Payment Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure payment methods and bank details
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank Details for EFT */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Bank Details (EFT)</h2>
              <p className="text-sm text-muted-foreground">For manual bank transfers</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Bank Name</Label>
              <Input
                value={settings.bank_name}
                onChange={(e) => handleChange("bank_name", e.target.value)}
                placeholder="e.g., FNB, Standard Bank, ABSA"
              />
            </div>

            <div>
              <Label className="mb-2 block">Account Holder Name</Label>
              <Input
                value={settings.account_holder}
                onChange={(e) => handleChange("account_holder", e.target.value)}
                placeholder="e.g., Silwer Lining Photography"
              />
            </div>

            <div>
              <Label className="mb-2 block">Account Number</Label>
              <Input
                value={settings.account_number}
                onChange={(e) => handleChange("account_number", e.target.value)}
                placeholder="e.g., 62123456789"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Branch Code</Label>
                <Input
                  value={settings.branch_code}
                  onChange={(e) => handleChange("branch_code", e.target.value)}
                  placeholder="e.g., 250655"
                />
              </div>

              <div>
                <Label className="mb-2 block">Account Type</Label>
                <Select
                  value={settings.account_type}
                  onValueChange={(val) => handleChange("account_type", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Savings">Savings</SelectItem>
                    <SelectItem value="Current">Current</SelectItem>
                    <SelectItem value="Transmission">Transmission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Reference Format</Label>
              <Input
                value={settings.reference_format}
                onChange={(e) => handleChange("reference_format", e.target.value)}
                placeholder="BOOKING-{booking_id}"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {"{booking_id}"} for the unique booking reference
              </p>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-6">
          {/* PayFast */}
          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold">PayFast</h2>
                  <p className="text-sm text-muted-foreground">Card & Instant EFT</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-600 font-medium">Configured</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm">Enable PayFast payments</span>
              <Switch
                checked={settings.payfast_enabled}
                onCheckedChange={(checked) => handleChange("payfast_enabled", checked)}
              />
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              PayFast credentials are configured in environment variables for security.
              Currently in <span className="font-medium text-amber-600">Sandbox/Test mode</span>.
            </p>
          </div>

          {/* PayFlex */}
          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="font-semibold">PayFlex</h2>
                  <p className="text-sm text-muted-foreground">Buy now, pay later</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4">
              <span className="text-sm">Enable PayFlex payments</span>
              <Switch
                checked={settings.payflex_enabled}
                onCheckedChange={(checked) => handleChange("payflex_enabled", checked)}
              />
            </div>

            <div>
              <Label className="mb-2 block">PayFlex API Key</Label>
              <Input
                type="password"
                value={settings.payflex_api_key}
                onChange={(e) => handleChange("payflex_api_key", e.target.value)}
                placeholder="Enter your PayFlex API key"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Get your API key from the PayFlex merchant portal
              </p>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
            <h3 className="font-semibold mb-3">Active Payment Methods</h3>
            <ul className="space-y-2">
              {settings.payfast_enabled && (
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  PayFast (Cards, Instant EFT, SnapScan)
                </li>
              )}
              {settings.payflex_enabled && settings.payflex_api_key && (
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  PayFlex (Pay in 4)
                </li>
              )}
              {settings.bank_name && settings.account_number && (
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Manual EFT / Bank Transfer
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSettingsPage;
