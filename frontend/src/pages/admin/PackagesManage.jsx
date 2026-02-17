import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Package, GripVertical, Check, X } from "lucide-react";
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
  { id: "studio", name: "Studio Portraits" },
  { id: "family", name: "Family" },
  { id: "baby-birthday", name: "Baby Birthday" },
  { id: "adult-birthday", name: "Adult Birthday" },
  { id: "brand-product", name: "Brand/Product" },
];

const PackagesManage = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [includeInput, setIncludeInput] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    session_type: "",
    price: "",
    duration: "",
    includes: [],
    description: "",
    popular: false,
    active: true,
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/packages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPackages(res.data);
    } catch (e) {
      toast.error("Failed to fetch packages");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addIncludeItem = () => {
    if (includeInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        includes: [...prev.includes, includeInput.trim()],
      }));
      setIncludeInput("");
    }
  };

  const removeIncludeItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      includes: prev.includes.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.session_type || !formData.price || !formData.duration) {
      toast.error("Please fill in all required fields");
      return;
    }

    const token = localStorage.getItem("admin_token");
    const payload = {
      ...formData,
      price: parseInt(formData.price),
    };

    try {
      if (editingPackage) {
        await axios.put(`${API}/admin/packages/${editingPackage.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Package updated");
      } else {
        await axios.post(`${API}/admin/packages`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Package created");
      }
      setDialogOpen(false);
      resetForm();
      fetchPackages();
    } catch (e) {
      toast.error("Failed to save package");
    }
  };

  const deletePackage = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/packages/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Package deleted");
      fetchPackages();
    } catch (e) {
      toast.error("Failed to delete package");
    }
  };

  const openEdit = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      session_type: pkg.session_type,
      price: pkg.price.toString(),
      duration: pkg.duration,
      includes: pkg.includes || [],
      description: pkg.description || "",
      popular: pkg.popular,
      active: pkg.active,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPackage(null);
    setFormData({
      name: "",
      session_type: "",
      price: "",
      duration: "",
      includes: [],
      description: "",
      popular: false,
      active: true,
    });
    setIncludeInput("");
  };

  const filteredPackages = filterType === "all"
    ? packages
    : packages.filter((pkg) => pkg.session_type === filterType);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="packages-manage">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">
          Manage Packages
        </h1>
        <div className="flex items-center gap-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]" data-testid="filter-type">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {sessionTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
            data-testid="add-package-btn"
          >
            <Plus className="w-4 h-4" />
            Add Package
          </Button>
        </div>
      </div>

      {filteredPackages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No packages found. Add your first package!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white rounded-xl shadow-soft p-6 ${!pkg.active ? "opacity-60" : ""}`}
              data-testid={`package-${pkg.id}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{pkg.name}</h3>
                      {pkg.popular && (
                        <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                          Popular
                        </span>
                      )}
                      {!pkg.active && (
                        <span className="bg-gray-400 text-white text-xs px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="font-display text-2xl font-semibold text-primary">
                      R{pkg.price.toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span className="capitalize">{pkg.session_type.replace("-", " ")}</span>
                    <span>•</span>
                    <span>{pkg.duration}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {pkg.includes?.slice(0, 4).map((item, i) => (
                      <span key={i} className="bg-warm-sand text-xs px-2 py-1 rounded">
                        {item}
                      </span>
                    ))}
                    {pkg.includes?.length > 4 && (
                      <span className="text-xs text-muted-foreground">
                        +{pkg.includes.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(pkg)}
                    data-testid={`edit-${pkg.id}`}
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-red-500"
                        data-testid={`delete-${pkg.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Package?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the "{pkg.name}" package.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deletePackage(pkg.id)}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Package Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? "Edit Package" : "Add New Package"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Package Name *</Label>
                <Input
                  placeholder="e.g., Signature"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  data-testid="input-name"
                />
              </div>
              <div>
                <Label className="mb-2 block">Session Type *</Label>
                <Select value={formData.session_type} onValueChange={(v) => handleChange("session_type", v)}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Price (ZAR) *</Label>
                <Input
                  type="number"
                  placeholder="5500"
                  value={formData.price}
                  onChange={(e) => handleChange("price", e.target.value)}
                  data-testid="input-price"
                />
              </div>
              <div>
                <Label className="mb-2 block">Duration *</Label>
                <Input
                  placeholder="e.g., 2-3 hours"
                  value={formData.duration}
                  onChange={(e) => handleChange("duration", e.target.value)}
                  data-testid="input-duration"
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Description</Label>
              <Textarea
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={2}
                data-testid="input-description"
              />
            </div>

            <div>
              <Label className="mb-2 block">What's Included</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Add item (press Enter)"
                  value={includeInput}
                  onChange={(e) => setIncludeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addIncludeItem())}
                  data-testid="input-includes"
                />
                <Button type="button" onClick={addIncludeItem} variant="outline">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.includes.map((item, index) => (
                  <span
                    key={index}
                    className="bg-warm-sand px-3 py-1 rounded-full text-sm flex items-center gap-2"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => removeIncludeItem(index)}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.popular}
                  onCheckedChange={(v) => handleChange("popular", v)}
                  data-testid="switch-popular"
                />
                <Label>Mark as Popular</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(v) => handleChange("active", v)}
                  data-testid="switch-active"
                />
                <Label>Active</Label>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full bg-primary hover:bg-primary/90 text-white mt-4"
              data-testid="save-package-btn"
            >
              {editingPackage ? "Update Package" : "Create Package"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PackagesManage;
