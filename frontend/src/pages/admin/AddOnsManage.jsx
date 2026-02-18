import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Tag, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const AddOnsManage = () => {
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    categories: [],
    active: true,
  });

  useEffect(() => {
    fetchAddons();
  }, []);

  const fetchAddons = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/addons`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAddons(res.data);
    } catch (e) {
      toast.error("Failed to fetch add-ons");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCategory = (categoryId) => {
    setFormData((prev) => {
      const current = prev.categories;
      if (current.includes(categoryId)) {
        return { ...prev, categories: current.filter(id => id !== categoryId) };
      } else {
        return { ...prev, categories: [...current, categoryId] };
      }
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      toast.error("Please fill in name and price");
      return;
    }

    const token = localStorage.getItem("admin_token");
    const payload = {
      ...formData,
      price: parseInt(formData.price),
    };

    try {
      if (editingItem) {
        await axios.put(`${API}/admin/addons/${editingItem.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Add-on updated");
      } else {
        await axios.post(`${API}/admin/addons`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Add-on created");
      }
      setDialogOpen(false);
      resetForm();
      fetchAddons();
    } catch (e) {
      toast.error("Failed to save add-on");
    }
  };

  const deleteAddon = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/addons/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Add-on deleted");
      fetchAddons();
    } catch (e) {
      toast.error("Failed to delete add-on");
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      categories: item.categories || [],
      active: item.active,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      categories: [],
      active: true,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="addons-manage">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Manage Add-ons
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure optional extras clients can add to their booking
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
          data-testid="add-addon-btn"
        >
          <Plus className="w-4 h-4" />
          Add New Add-on
        </Button>
      </div>

      {addons.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No add-ons yet. Create your first add-on!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {addons.map((addon) => (
            <div
              key={addon.id}
              className={`bg-white rounded-xl shadow-soft p-6 ${!addon.active ? "opacity-60" : ""}`}
              data-testid={`addon-${addon.id}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{addon.name}</h3>
                    {!addon.active && (
                      <span className="bg-gray-400 text-white text-xs px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  
                  {addon.description && (
                    <p className="text-sm text-muted-foreground mb-3">{addon.description}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl font-semibold text-primary">
                      R{addon.price.toLocaleString()}
                    </span>
                    {addon.categories && addon.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1 ml-4">
                        {addon.categories.map((cat) => (
                          <span key={cat} className="bg-warm-sand text-xs px-2 py-1 rounded capitalize">
                            {cat.replace("-", " ")}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground ml-4">All categories</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(addon)}
                    data-testid={`edit-${addon.id}`}
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
                        data-testid={`delete-${addon.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Add-on?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{addon.name}".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAddon(addon.id)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Add-on" : "Create New Add-on"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="mb-2 block">Name *</Label>
              <Input
                placeholder="e.g., Makeup Artist"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                data-testid="input-name"
              />
            </div>

            <div>
              <Label className="mb-2 block">Price (ZAR) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="800"
                  value={formData.price}
                  onChange={(e) => handleChange("price", e.target.value)}
                  className="pl-10"
                  data-testid="input-price"
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Description</Label>
              <Textarea
                placeholder="Brief description of this add-on"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={2}
                data-testid="input-description"
              />
            </div>

            <div>
              <Label className="mb-3 block">Available for Categories</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Leave empty to make available for all session types
              </p>
              <div className="grid grid-cols-2 gap-2">
                {sessionTypes.map((type) => (
                  <div
                    key={type.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      formData.categories.includes(type.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                    onClick={() => toggleCategory(type.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.categories.includes(type.id)}
                        onCheckedChange={() => toggleCategory(type.id)}
                        className="pointer-events-none"
                      />
                      <span className="text-sm">{type.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label>Active</Label>
              <Switch
                checked={formData.active}
                onCheckedChange={(v) => handleChange("active", v)}
                data-testid="switch-active"
              />
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full bg-primary hover:bg-primary/90 text-white mt-4"
              data-testid="save-addon-btn"
            >
              {editingItem ? "Update Add-on" : "Create Add-on"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddOnsManage;
