import { useState, useEffect } from "react";
import { Cloud, Save, Check, AlertCircle, Instagram, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SettingsPage = () => {
  const [storageSettings, setStorageSettings] = useState({
    provider: "cloudflare_r2",
    account_id: "",
    access_key_id: "",
    secret_access_key: "",
    bucket_name: "",
    public_url: "",
  });
  
  const [instagramSettings, setInstagramSettings] = useState({
    access_token: "",
    enabled: true,
    post_count: 6,
  });
  
  const [storageSaving, setStorageSaving] = useState(false);
  const [instagramSaving, setInstagramSaving] = useState(false);
  const [instagramPreview, setInstagramPreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const [storageRes, instagramRes] = await Promise.all([
        axios.get(`${API}/admin/storage-settings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/admin/instagram-settings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setStorageSettings(storageRes.data);
      setInstagramSettings(instagramRes.data);
    } catch (e) {
      console.error("Failed to fetch settings");
    }
  };

  const saveStorageSettings = async () => {
    setStorageSaving(true);
    const token = localStorage.getItem("admin_token");
    try {
      await axios.put(`${API}/admin/storage-settings`, storageSettings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Storage settings saved");
    } catch (e) {
      toast.error("Failed to save storage settings");
    } finally {
      setStorageSaving(false);
    }
  };

  const saveInstagramSettings = async () => {
    setInstagramSaving(true);
    const token = localStorage.getItem("admin_token");
    try {
      await axios.put(`${API}/admin/instagram-settings`, instagramSettings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Instagram settings saved");
    } catch (e) {
      toast.error("Failed to save Instagram settings");
    } finally {
      setInstagramSaving(false);
    }
  };

  const testInstagramFeed = async () => {
    setLoadingPreview(true);
    try {
      const res = await axios.get(`${API}/instagram/feed`);
      if (res.data.error) {
        toast.error(res.data.error);
        setInstagramPreview([]);
      } else {
        setInstagramPreview(res.data.posts);
        if (res.data.posts.length > 0) {
          toast.success(`Found ${res.data.posts.length} posts`);
        } else {
          toast.warning("No posts found");
        }
      }
    } catch (e) {
      toast.error("Failed to fetch Instagram feed");
      setInstagramPreview([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div data-testid="settings-page">
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">
          Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure storage and integrations
        </p>
      </div>

      <div className="space-y-8">
        {/* Cloudflare R2 Storage Settings */}
        <div className="bg-white rounded-xl shadow-soft p-6" data-testid="storage-settings">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Cloudflare R2 Storage</h2>
              <p className="text-sm text-muted-foreground">Configure image upload storage</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Account ID</Label>
              <Input
                placeholder="Your Cloudflare Account ID"
                value={storageSettings.account_id}
                onChange={(e) => setStorageSettings(prev => ({ ...prev, account_id: e.target.value }))}
                data-testid="input-account-id"
              />
            </div>
            <div>
              <Label className="mb-2 block">Bucket Name</Label>
              <Input
                placeholder="Your R2 bucket name"
                value={storageSettings.bucket_name}
                onChange={(e) => setStorageSettings(prev => ({ ...prev, bucket_name: e.target.value }))}
                data-testid="input-bucket-name"
              />
            </div>
            <div>
              <Label className="mb-2 block">Access Key ID</Label>
              <Input
                placeholder="R2 Access Key ID"
                value={storageSettings.access_key_id}
                onChange={(e) => setStorageSettings(prev => ({ ...prev, access_key_id: e.target.value }))}
                data-testid="input-access-key"
              />
            </div>
            <div>
              <Label className="mb-2 block">Secret Access Key</Label>
              <Input
                type="password"
                placeholder="R2 Secret Access Key"
                value={storageSettings.secret_access_key}
                onChange={(e) => setStorageSettings(prev => ({ ...prev, secret_access_key: e.target.value }))}
                data-testid="input-secret-key"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-2 block">Public URL (Optional)</Label>
              <Input
                placeholder="e.g., https://images.yourdomain.com"
                value={storageSettings.public_url}
                onChange={(e) => setStorageSettings(prev => ({ ...prev, public_url: e.target.value }))}
                data-testid="input-public-url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Custom domain for serving images. Leave empty to use R2 default URL.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              {storageSettings.access_key_id ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">Configured</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-600">Not configured</span>
                </>
              )}
            </div>
            <Button
              onClick={saveStorageSettings}
              disabled={storageSaving}
              className="bg-primary hover:bg-primary/90 text-white"
              data-testid="save-storage-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              {storageSaving ? "Saving..." : "Save Storage Settings"}
            </Button>
          </div>
        </div>

        {/* Instagram Settings */}
        <div className="bg-white rounded-xl shadow-soft p-6" data-testid="instagram-settings">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Instagram Feed</h2>
              <p className="text-sm text-muted-foreground">Show recent Instagram posts on your homepage</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Instagram Feed</Label>
                <p className="text-xs text-muted-foreground">Show recent posts in "Recent Shoots" section</p>
              </div>
              <Switch
                checked={instagramSettings.enabled}
                onCheckedChange={(v) => setInstagramSettings(prev => ({ ...prev, enabled: v }))}
                data-testid="instagram-enabled-switch"
              />
            </div>

            <div>
              <Label className="mb-2 block">Instagram Access Token</Label>
              <Input
                type="password"
                placeholder="Your Instagram Graph API access token"
                value={instagramSettings.access_token}
                onChange={(e) => setInstagramSettings(prev => ({ ...prev, access_token: e.target.value }))}
                data-testid="input-instagram-token"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Get this from your Facebook Developer App with Instagram Basic Display.
              </p>
            </div>

            <div>
              <Label className="mb-2 block">Number of Posts to Display</Label>
              <Input
                type="number"
                min="1"
                max="12"
                value={instagramSettings.post_count}
                onChange={(e) => setInstagramSettings(prev => ({ ...prev, post_count: parseInt(e.target.value) || 6 }))}
                className="w-32"
                data-testid="input-post-count"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={testInstagramFeed}
              disabled={loadingPreview}
              data-testid="test-instagram-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingPreview ? "animate-spin" : ""}`} />
              {loadingPreview ? "Loading..." : "Test Connection"}
            </Button>
            <Button
              onClick={saveInstagramSettings}
              disabled={instagramSaving}
              className="bg-primary hover:bg-primary/90 text-white"
              data-testid="save-instagram-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              {instagramSaving ? "Saving..." : "Save Instagram Settings"}
            </Button>
          </div>

          {/* Instagram Preview */}
          {instagramPreview.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="font-medium mb-3">Preview (Latest {instagramPreview.length} posts)</h4>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {instagramPreview.map((post) => (
                  <a
                    key={post.id}
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={post.image_url}
                      alt={post.caption || "Instagram post"}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="bg-warm-sand rounded-xl p-6">
          <h3 className="font-semibold mb-4">Setup Help</h3>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium">Cloudflare R2 Setup</h4>
              <ol className="list-decimal list-inside text-muted-foreground mt-1 space-y-1">
                <li>Go to Cloudflare Dashboard → R2</li>
                <li>Create a bucket (e.g., "silwerlining-photos")</li>
                <li>Go to "Manage R2 API Tokens" → Create token</li>
                <li>Copy Account ID, Access Key ID, and Secret Key</li>
                <li>For custom domain, add a public URL for your bucket</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium">Instagram Setup</h4>
              <ol className="list-decimal list-inside text-muted-foreground mt-1 space-y-1">
                <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">developers.facebook.com</a></li>
                <li>Create an App → Add "Instagram Basic Display"</li>
                <li>Add your Instagram account as a test user</li>
                <li>Generate a long-lived access token</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
