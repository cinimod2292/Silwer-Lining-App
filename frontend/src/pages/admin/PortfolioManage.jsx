import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Star, Image } from "lucide-react";
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

const categories = [
  { id: "maternity", name: "Maternity" },
  { id: "newborn", name: "Newborn" },
  { id: "family", name: "Family" },
  { id: "individual", name: "Individual" },
];

const PortfolioManage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    image_url: "",
    description: "",
    featured: false,
  });

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/portfolio`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(res.data);
    } catch (e) {
      toast.error("Failed to fetch portfolio");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.category || !formData.image_url) {
      toast.error("Please fill in all required fields");
      return;
    }

    const token = localStorage.getItem("admin_token");
    try {
      if (editingItem) {
        await axios.put(`${API}/admin/portfolio/${editingItem.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Portfolio item updated");
      } else {
        await axios.post(`${API}/admin/portfolio`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Portfolio item added");
      }
      setDialogOpen(false);
      resetForm();
      fetchPortfolio();
    } catch (e) {
      toast.error("Failed to save portfolio item");
    }
  };

  const deleteItem = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/portfolio/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Portfolio item deleted");
      fetchPortfolio();
    } catch (e) {
      toast.error("Failed to delete item");
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      category: item.category,
      image_url: item.image_url,
      description: item.description || "",
      featured: item.featured,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      category: "",
      image_url: "",
      description: "",
      featured: false,
    });
  };

  const filteredItems = filterCategory === "all"
    ? items
    : items.filter((item) => item.category === filterCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="portfolio-manage">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">
          Manage Portfolio
        </h1>
        <div className="flex items-center gap-4">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]" data-testid="filter-category">
              <SelectValue placeholder="Filter category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white gap-2" data-testid="add-portfolio-btn">
                <Plus className="w-4 h-4" />
                Add Image
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "Edit Portfolio Item" : "Add Portfolio Item"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="mb-2 block">Title *</Label>
                  <Input
                    placeholder="Image title"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    data-testid="input-title"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Category *</Label>
                  <Select value={formData.category} onValueChange={(v) => handleChange("category", v)}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Image URL *</Label>
                  <Input
                    placeholder="https://..."
                    value={formData.image_url}
                    onChange={(e) => handleChange("image_url", e.target.value)}
                    data-testid="input-image-url"
                  />
                  {formData.image_url && (
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="mt-2 w-full h-32 object-cover rounded-lg"
                    />
                  )}
                </div>
                <div>
                  <Label className="mb-2 block">Description</Label>
                  <Textarea
                    placeholder="Optional description"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    rows={3}
                    data-testid="input-description"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Featured on Homepage</Label>
                  <Switch
                    checked={formData.featured}
                    onCheckedChange={(v) => handleChange("featured", v)}
                    data-testid="switch-featured"
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                  data-testid="save-portfolio-btn"
                >
                  {editingItem ? "Update" : "Add to Portfolio"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <Image className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No portfolio items yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-soft overflow-hidden group"
              data-testid={`portfolio-item-${item.id}`}
            >
              <div className="relative aspect-[4/3]">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                {item.featured && (
                  <div className="absolute top-2 right-2 bg-primary text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Featured
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEdit(item)}
                    data-testid={`edit-${item.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        data-testid={`delete-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Image?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{item.title}" from your portfolio.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteItem(item.id)}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground capitalize">{item.category}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortfolioManage;
