import { useState, useEffect } from "react";
import { Plus, Trash2, Star, RefreshCw, Settings, ExternalLink, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const sessionTypes = [
  { id: "maternity", name: "Maternity" },
  { id: "newborn", name: "Newborn" },
  { id: "family", name: "Family" },
  { id: "individual", name: "Individual" },
  { id: "google", name: "Google Review" },
];

const TestimonialsManage = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [googleReviews, setGoogleReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("manual"); // manual or google
  
  const [formData, setFormData] = useState({
    client_name: "",
    session_type: "",
    content: "",
    rating: 5,
    image_url: "",
  });

  const [googleSettings, setGoogleSettings] = useState({
    enabled: false,
    api_key: "",
    place_id: "",
    auto_fetch: false,
    fetch_frequency: "daily",
    last_fetched: null,
  });

  useEffect(() => {
    fetchTestimonials();
    fetchGoogleSettings();
  }, []);

  const fetchTestimonials = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/testimonials`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTestimonials(res.data.filter(t => t.source !== "google"));
      setGoogleReviews(res.data.filter(t => t.source === "google"));
    } catch (e) {
      toast.error("Failed to fetch testimonials");
    } finally {
      setLoading(false);
    }
  };

  const fetchGoogleSettings = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/google-reviews/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        setGoogleSettings(res.data);
      }
    } catch (e) {
      // Settings don't exist yet
    }
  };

  const saveGoogleSettings = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.put(`${API}/admin/google-reviews/settings`, googleSettings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Google Reviews settings saved");
      setSettingsOpen(false);
    } catch (e) {
      toast.error("Failed to save settings");
    }
  };

  const fetchGoogleReviews = async () => {
    const token = localStorage.getItem("admin_token");
    setFetching(true);
    try {
      const res = await axios.post(`${API}/admin/google-reviews/fetch`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Fetched ${res.data.count || 0} reviews from Google`);
      fetchTestimonials();
      fetchGoogleSettings();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to fetch Google reviews");
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.client_name || !formData.session_type || !formData.content) {
      toast.error("Please fill in all required fields");
      return;
    }

    const token = localStorage.getItem("admin_token");
    try {
      await axios.post(`${API}/admin/testimonials`, { ...formData, source: "manual" }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Testimonial added");
      setDialogOpen(false);
      resetForm();
      fetchTestimonials();
    } catch (e) {
      toast.error("Failed to add testimonial");
    }
  };

  const toggleApproval = async (id, approved) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.put(`${API}/admin/testimonials/${id}?approved=${!approved}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(approved ? "Review hidden" : "Review approved");
      fetchTestimonials();
    } catch (e) {
      toast.error("Failed to update");
    }
  };

  const deleteTestimonial = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/testimonials/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Deleted");
      fetchTestimonials();
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const resetForm = () => {
    setFormData({
      client_name: "",
      session_type: "",
      content: "",
      rating: 5,
      image_url: "",
    });
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
      />
    ));
  };

  const ReviewCard = ({ review, isGoogle = false }) => (
    <div className="bg-white rounded-xl shadow-soft p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {review.image_url || review.profile_photo_url ? (
            <img src={review.image_url || review.profile_photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              {review.client_name?.[0] || review.author_name?.[0] || "?"}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-sm">{review.client_name || review.author_name}</h3>
            <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isGoogle && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Google</span>
          )}
          <Button variant="ghost" size="sm" onClick={() => toggleApproval(review.id, review.approved)}>
            {review.approved ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-gray-400" />}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm"><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this review?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteTestimonial(review.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{review.content || review.text}</p>
      {review.relative_time_description && (
        <p className="text-xs text-gray-400 mt-2">{review.relative_time_description}</p>
      )}
      {!review.approved && (
        <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Hidden</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Reviews & Testimonials</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage manual testimonials and Google reviews</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Settings className="w-4 h-4 mr-2" />Google Settings</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Google Reviews Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Google Reviews</Label>
                  <Switch
                    checked={googleSettings.enabled}
                    onCheckedChange={(v) => setGoogleSettings({...googleSettings, enabled: v})}
                  />
                </div>
                {googleSettings.enabled && (
                  <>
                    <div>
                      <Label>Google Places API Key</Label>
                      <Input
                        type="password"
                        value={googleSettings.api_key}
                        onChange={(e) => setGoogleSettings({...googleSettings, api_key: e.target.value})}
                        placeholder="AIza..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Get from <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-primary underline">Google Cloud Console</a>
                      </p>
                    </div>
                    <div>
                      <Label>Place ID</Label>
                      <Input
                        value={googleSettings.place_id}
                        onChange={(e) => setGoogleSettings({...googleSettings, place_id: e.target.value})}
                        placeholder="ChIJ..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Find at <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer" className="text-primary underline">Place ID Finder</a>
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Auto-fetch reviews</Label>
                      <Switch
                        checked={googleSettings.auto_fetch}
                        onCheckedChange={(v) => setGoogleSettings({...googleSettings, auto_fetch: v})}
                      />
                    </div>
                    {googleSettings.auto_fetch && (
                      <div>
                        <Label>Fetch Frequency</Label>
                        <Select
                          value={googleSettings.fetch_frequency}
                          onValueChange={(v) => setGoogleSettings({...googleSettings, fetch_frequency: v})}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {googleSettings.last_fetched && (
                      <p className="text-xs text-muted-foreground">
                        Last fetched: {new Date(googleSettings.last_fetched).toLocaleString()}
                      </p>
                    )}
                  </>
                )}
                <Button onClick={saveGoogleSettings} className="w-full">Save Settings</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === "manual" ? "default" : "outline"}
          onClick={() => setActiveTab("manual")}
        >
          Manual ({testimonials.length})
        </Button>
        <Button
          variant={activeTab === "google" ? "default" : "outline"}
          onClick={() => setActiveTab("google")}
        >
          Google Reviews ({googleReviews.length})
        </Button>
      </div>

      {activeTab === "manual" && (
        <>
          <div className="flex justify-end mb-4">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Add Testimonial</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Testimonial</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Client Name *</Label>
                    <Input
                      value={formData.client_name}
                      onChange={(e) => handleChange("client_name", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Session Type *</Label>
                    <Select value={formData.session_type} onValueChange={(v) => handleChange("session_type", v)}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {sessionTypes.filter(s => s.id !== "google").map((type) => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Rating</Label>
                    <div className="flex gap-1 mt-1">
                      {[1,2,3,4,5].map((r) => (
                        <button key={r} onClick={() => handleChange("rating", r)}>
                          <Star className={`w-6 h-6 ${r <= formData.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Testimonial *</Label>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => handleChange("content", e.target.value)}
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleSubmit} className="w-full">Add Testimonial</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {testimonials.length === 0 ? (
            <div className="bg-white rounded-xl shadow-soft p-12 text-center">
              <Star className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Testimonials Yet</h3>
              <p className="text-muted-foreground">Add your first client testimonial</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => <ReviewCard key={t.id} review={t} />)}
            </div>
          )}
        </>
      )}

      {activeTab === "google" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              {googleSettings.enabled ? "Google Reviews integration enabled" : "Enable in Google Settings to fetch reviews"}
            </p>
            {googleSettings.enabled && (
              <Button onClick={fetchGoogleReviews} disabled={fetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${fetching ? "animate-spin" : ""}`} />
                {fetching ? "Fetching..." : "Fetch Now"}
              </Button>
            )}
          </div>

          {!googleSettings.enabled ? (
            <div className="bg-white rounded-xl shadow-soft p-12 text-center">
              <Settings className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Google Reviews Not Configured</h3>
              <p className="text-muted-foreground mb-4">Set up your API key and Place ID to fetch reviews</p>
              <Button variant="outline" onClick={() => setSettingsOpen(true)}>Open Settings</Button>
            </div>
          ) : googleReviews.length === 0 ? (
            <div className="bg-white rounded-xl shadow-soft p-12 text-center">
              <RefreshCw className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Google Reviews Fetched</h3>
              <p className="text-muted-foreground mb-4">Click "Fetch Now" to get your latest reviews</p>
              <Button onClick={fetchGoogleReviews} disabled={fetching}>
                {fetching ? "Fetching..." : "Fetch Reviews"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {googleReviews.map((r) => <ReviewCard key={r.id} review={r} isGoogle />)}
            </div>
          )}

          {googleSettings.enabled && googleSettings.place_id && (
            <div className="mt-6 text-center">
              <a
                href={`https://search.google.com/local/reviews?placeid=${googleSettings.place_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                View all reviews on Google <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TestimonialsManage;
