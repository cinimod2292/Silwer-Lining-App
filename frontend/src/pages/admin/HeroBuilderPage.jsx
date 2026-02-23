import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import axios from "axios";
import { Save, Upload, Eye } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const HeroBuilderPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/hero-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(res.data);
    } catch (e) {
      toast.error("Failed to load hero settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("admin_token");
    setSaving(true);
    try {
      await axios.put(`${API}/admin/hero-settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Hero section updated");
    } catch (e) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem("admin_token");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/admin/upload-image`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
      });
      setSettings(prev => ({ ...prev, image_url: res.data.url }));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const update = (field, value) => setSettings(prev => ({ ...prev, [field]: value }));

  if (loading || !settings) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8" data-testid="hero-builder">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hero Section Builder</h1>
        <Button onClick={handleSave} disabled={saving} data-testid="hero-save-btn">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Live Preview */}
      <div className="border rounded-xl overflow-hidden" data-testid="hero-preview">
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">Live Preview</span>
        </div>
        <div className="relative h-[350px] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img
              src={settings.image_url}
              alt="Hero preview"
              className="w-full h-full object-cover"
              style={{ opacity: (settings.image_opacity ?? 100) / 100 }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right, rgba(250,247,242,${(settings.overlay_opacity ?? 70) / 100}) 0%, rgba(250,247,242,${(settings.overlay_opacity ?? 70) / 100 * 0.7}) 50%, transparent 100%)`
              }}
            />
          </div>
          <div className="relative z-10 px-12 max-w-2xl">
            <p className="text-primary font-medium tracking-widest uppercase text-xs mb-2">
              {settings.subtitle}
            </p>
            <h1 className="font-display text-3xl font-semibold text-foreground leading-tight mb-3">
              {settings.title_line1}{" "}
              <span className="italic text-primary">{settings.title_highlight}</span>{" "}
              {settings.title_line2}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {settings.description}
            </p>
            <div className="flex gap-3">
              <span className="bg-primary text-white text-xs px-4 py-2 rounded-full">{settings.button1_text}</span>
              <span className="border text-xs px-4 py-2 rounded-full">{settings.button2_text}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Text Content */}
        <div className="space-y-5 border rounded-xl p-6">
          <h2 className="font-semibold text-lg border-b pb-2">Text Content</h2>

          <div>
            <Label>Subtitle (small text above heading)</Label>
            <Input value={settings.subtitle} onChange={e => update("subtitle", e.target.value)} data-testid="hero-subtitle" />
          </div>

          <div>
            <Label>Heading Line 1</Label>
            <Input value={settings.title_line1} onChange={e => update("title_line1", e.target.value)} data-testid="hero-title1" />
          </div>

          <div>
            <Label>Highlighted Word (italic accent)</Label>
            <Input value={settings.title_highlight} onChange={e => update("title_highlight", e.target.value)} data-testid="hero-highlight" />
          </div>

          <div>
            <Label>Heading Line 2</Label>
            <Input value={settings.title_line2} onChange={e => update("title_line2", e.target.value)} data-testid="hero-title2" />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={settings.description} onChange={e => update("description", e.target.value)} data-testid="hero-description" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Button 1 Text</Label>
              <Input value={settings.button1_text} onChange={e => update("button1_text", e.target.value)} />
            </div>
            <div>
              <Label>Button 2 Text</Label>
              <Input value={settings.button2_text} onChange={e => update("button2_text", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Image & Opacity */}
        <div className="space-y-5 border rounded-xl p-6">
          <h2 className="font-semibold text-lg border-b pb-2">Image & Opacity</h2>

          <div>
            <Label>Hero Image</Label>
            <div className="mt-2 space-y-3">
              <div className="h-40 rounded-lg overflow-hidden border bg-muted">
                <img src={settings.image_url} alt="Current hero" className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-2">
                <label className="flex-1">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <Button variant="outline" className="w-full" asChild disabled={uploading}>
                    <span><Upload className="w-4 h-4 mr-2" />{uploading ? "Uploading..." : "Upload New Image"}</span>
                  </Button>
                </label>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Or paste image URL</Label>
                <Input value={settings.image_url} onChange={e => update("image_url", e.target.value)} placeholder="https://..." className="mt-1" data-testid="hero-image-url" />
              </div>
            </div>
          </div>

          <div>
            <Label>Image Opacity: {settings.image_opacity ?? 100}%</Label>
            <Slider
              value={[settings.image_opacity ?? 100]}
              onValueChange={([v]) => update("image_opacity", v)}
              min={10} max={100} step={5}
              className="mt-2"
              data-testid="hero-image-opacity"
            />
          </div>

          <div>
            <Label>Overlay Opacity: {settings.overlay_opacity ?? 70}%</Label>
            <p className="text-xs text-muted-foreground mb-1">Controls how visible the text background overlay is</p>
            <Slider
              value={[settings.overlay_opacity ?? 70]}
              onValueChange={([v]) => update("overlay_opacity", v)}
              min={0} max={100} step={5}
              className="mt-2"
              data-testid="hero-overlay-opacity"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBuilderPage;
