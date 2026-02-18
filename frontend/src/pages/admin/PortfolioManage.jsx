import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Upload, Image, Loader2, CheckCircle, X, AlertCircle } from "lucide-react";
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

const categories = [
  { id: "maternity", name: "Maternity" },
  { id: "newborn", name: "Newborn" },
  { id: "family", name: "Family" },
  { id: "studio", name: "Studio Portraits" },
  { id: "baby-birthday", name: "Baby Birthday" },
  { id: "adult-birthday", name: "Adult Birthday" },
  { id: "brand-product", name: "Brand/Product" },
];

const PortfolioManage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const fileInputRef = useRef(null);

  // Single item form
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    image_url: "",
    description: "",
    featured: false,
  });

  // Multi-upload state
  const [uploadCategory, setUploadCategory] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
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
      toast.error("Please fill in title, category, and image URL");
      return;
    }

    const token = localStorage.getItem("admin_token");
    try {
      if (editingItem) {
        await axios.put(`${API}/admin/portfolio/${editingItem.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Item updated");
      } else {
        await axios.post(`${API}/admin/portfolio`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Item created");
      }
      setDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (e) {
      toast.error("Failed to save item");
    }
  };

  const deleteItem = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/portfolio/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Item deleted");
      fetchItems();
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
      featured: item.featured || false,
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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast.warning("Some files were skipped (only images allowed)");
    }
    
    setSelectedFiles(imageFiles);
    setUploadProgress(imageFiles.map(f => ({ name: f.name, status: 'pending', url: null })));
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadProgress(prev => prev.filter((_, i) => i !== index));
  };

  const handleMultiUpload = async () => {
    if (!uploadCategory) {
      toast.error("Please select a category");
      return;
    }
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one image");
      return;
    }

    setUploading(true);
    const token = localStorage.getItem("admin_token");
    
    // Create FormData
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const res = await axios.post(
        `${API}/admin/upload-images?category=${uploadCategory}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (res.data.success) {
        // Update progress to show success
        setUploadProgress(prev => 
          prev.map((p, i) => ({
            ...p,
            status: 'success',
            url: res.data.uploaded[i]?.url || null
          }))
        );
        
        toast.success(`Uploaded ${res.data.count} images successfully!`);
        
        // Wait a moment then close and refresh
        setTimeout(() => {
          setUploadDialogOpen(false);
          setSelectedFiles([]);
          setUploadProgress([]);
          setUploadCategory("");
          fetchItems();
        }, 1500);
      }
    } catch (e) {
      const errorMsg = e.response?.data?.detail || "Upload failed";
      toast.error(errorMsg);
      
      // Check if it's a storage configuration error
      if (errorMsg.includes("Storage not configured")) {
        toast.info("Please configure R2 storage in Settings first");
      }
      
      setUploadProgress(prev => prev.map(p => ({ ...p, status: 'error' })));
    } finally {
      setUploading(false);
    }
  };

  const filteredItems = filterCategory === "all" 
    ? items 
    : items.filter(item => item.category === filterCategory);

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
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Portfolio
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {items.length} images in portfolio
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setUploadDialogOpen(true)}
            className="gap-2"
            data-testid="bulk-upload-btn"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
            data-testid="add-single-btn"
          >
            <Plus className="w-4 h-4" />
            Add by URL
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48" data-testid="filter-category">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <Image className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No portfolio items yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group relative bg-white rounded-xl shadow-soft overflow-hidden"
              data-testid={`portfolio-${item.id}`}
            >
              <div className="aspect-square">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              
              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                <div className="flex justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 bg-white/20 hover:bg-white/40 text-white"
                    onClick={() => openEdit(item)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 bg-white/20 hover:bg-red-500/80 text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Image?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this portfolio item.
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
                <div>
                  <p className="text-white text-sm font-medium truncate">{item.title}</p>
                  <p className="text-white/70 text-xs capitalize">{item.category?.replace("-", " ")}</p>
                </div>
              </div>

              {/* Featured badge */}
              {item.featured && (
                <div className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-0.5 rounded">
                  Featured
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Single Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
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
              />
            </div>

            <div>
              <Label className="mb-2 block">Category *</Label>
              <Select value={formData.category} onValueChange={(v) => handleChange("category", v)}>
                <SelectTrigger>
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
              />
            </div>

            <div>
              <Label className="mb-2 block">Description (Optional)</Label>
              <Textarea
                placeholder="Brief description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Featured (Shows in homepage)</Label>
              <Switch
                checked={formData.featured}
                onCheckedChange={(v) => handleChange("featured", v)}
              />
            </div>

            {formData.image_url && (
              <div className="border rounded-lg p-2">
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>
            )}

            <Button
              onClick={handleSubmit}
              className="w-full bg-primary hover:bg-primary/90 text-white"
            >
              {editingItem ? "Update Item" : "Add to Portfolio"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) {
          setSelectedFiles([]);
          setUploadProgress([]);
          setUploadCategory("");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Photos</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label className="mb-2 block">Category *</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger data-testid="upload-category-select">
                  <SelectValue placeholder="Select category for all photos" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drop Zone */}
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="upload-dropzone"
            >
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Click to select photos</p>
              <p className="text-sm text-muted-foreground">or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-2">
                Supports JPG, PNG, WebP (max 10MB each)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="file-input"
              />
            </div>

            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>{selectedFiles.length} photos selected</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFiles([]);
                      setUploadProgress([]);
                    }}
                    className="text-muted-foreground"
                  >
                    Clear all
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-warm-sand">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* Status overlay */}
                      {uploadProgress[index]?.status === 'success' && (
                        <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center rounded-lg">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                      )}
                      {uploadProgress[index]?.status === 'error' && (
                        <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center rounded-lg">
                          <AlertCircle className="w-6 h-6 text-white" />
                        </div>
                      )}
                      
                      {/* Remove button */}
                      {!uploading && (
                        <button
                          onClick={() => removeFile(index)}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      )}
                      
                      <p className="text-xs truncate mt-1">{file.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setUploadDialogOpen(false)}
                className="flex-1"
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleMultiUpload}
                disabled={uploading || !uploadCategory || selectedFiles.length === 0}
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
                data-testid="upload-submit-btn"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {selectedFiles.length} Photos
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Photos will be uploaded to your Cloudflare R2 storage.
              Make sure R2 is configured in Settings.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortfolioManage;
