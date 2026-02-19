import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, GripVertical, HelpCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const categories = [
  { id: "general", name: "General", color: "bg-gray-100 text-gray-700" },
  { id: "booking", name: "Booking", color: "bg-blue-100 text-blue-700" },
  { id: "pricing", name: "Pricing", color: "bg-green-100 text-green-700" },
  { id: "session", name: "Sessions", color: "bg-purple-100 text-purple-700" },
  { id: "preparation", name: "Preparation", color: "bg-yellow-100 text-yellow-700" },
  { id: "gallery", name: "Gallery & Prints", color: "bg-pink-100 text-pink-700" },
];

const FAQManage = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "general",
    order: 0,
    active: true,
  });

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/faqs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFaqs(res.data);
    } catch (e) {
      toast.error("Failed to fetch FAQs");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.question || !formData.answer) {
      toast.error("Please fill in question and answer");
      return;
    }

    const token = localStorage.getItem("admin_token");
    const payload = {
      ...formData,
      order: editingItem ? formData.order : faqs.length,
    };

    try {
      if (editingItem) {
        await axios.put(`${API}/admin/faqs/${editingItem.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("FAQ updated");
      } else {
        await axios.post(`${API}/admin/faqs`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("FAQ created");
      }
      setDialogOpen(false);
      resetForm();
      fetchFAQs();
    } catch (e) {
      toast.error("Failed to save FAQ");
    }
  };

  const deleteFAQ = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/faqs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("FAQ deleted");
      fetchFAQs();
    } catch (e) {
      toast.error("Failed to delete FAQ");
    }
  };

  const moveFAQ = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= faqs.length) return;
    
    const newFaqs = [...faqs];
    const [moved] = newFaqs.splice(index, 1);
    newFaqs.splice(newIndex, 0, moved);
    
    // Update order values
    const updates = newFaqs.map((faq, i) => ({ id: faq.id, order: i }));
    
    const token = localStorage.getItem("admin_token");
    try {
      await axios.put(`${API}/admin/faqs/reorder`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFaqs(newFaqs.map((f, i) => ({ ...f, order: i })));
    } catch (e) {
      toast.error("Failed to reorder");
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      question: item.question,
      answer: item.answer,
      category: item.category,
      order: item.order,
      active: item.active,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      question: "",
      answer: "",
      category: "general",
      order: 0,
      active: true,
    });
  };

  const getCategoryInfo = (id) => {
    return categories.find(c => c.id === id) || categories[0];
  };

  const filteredFAQs = filterCategory === "all" 
    ? faqs 
    : faqs.filter(f => f.category === filterCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="faq-manage">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Manage FAQs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {faqs.length} frequently asked questions
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
          data-testid="add-faq-btn"
        >
          <Plus className="w-4 h-4" />
          Add FAQ
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
            filterCategory === "all"
              ? "bg-primary text-white"
              : "bg-white border hover:bg-warm-sand"
          }`}
        >
          All ({faqs.length})
        </button>
        {categories.map((cat) => {
          const count = faqs.filter(f => f.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                filterCategory === cat.id
                  ? "bg-primary text-white"
                  : `${cat.color} hover:opacity-80`
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* FAQ List */}
      {filteredFAQs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No FAQs found. Create your first FAQ!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFAQs.map((faq, index) => {
            const catInfo = getCategoryInfo(faq.category);
            return (
              <div
                key={faq.id}
                className={`bg-white rounded-xl shadow-soft overflow-hidden ${!faq.active ? "opacity-60" : ""}`}
                data-testid={`faq-${faq.id}`}
              >
                <div className="flex items-start gap-4 p-5">
                  {/* Drag Handle & Reorder */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <button
                      onClick={() => moveFAQ(index, -1)}
                      disabled={index === 0}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <button
                      onClick={() => moveFAQ(index, 1)}
                      disabled={index === filteredFAQs.length - 1}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${catInfo.color}`}>
                        {catInfo.name}
                      </span>
                      {!faq.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{faq.question}</h3>
                    <p className="text-muted-foreground text-sm line-clamp-2">{faq.answer}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(faq)}
                      data-testid={`edit-${faq.id}`}
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
                          data-testid={`delete-${faq.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this FAQ.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteFAQ(faq.id)}
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
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit FAQ" : "Add New FAQ"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="mb-2 block">Question *</Label>
              <Input
                placeholder="e.g., How do I book a session?"
                value={formData.question}
                onChange={(e) => handleChange("question", e.target.value)}
                data-testid="input-question"
              />
            </div>

            <div>
              <Label className="mb-2 block">Answer *</Label>
              <Textarea
                placeholder="Provide a clear, helpful answer..."
                value={formData.answer}
                onChange={(e) => handleChange("answer", e.target.value)}
                rows={4}
                data-testid="input-answer"
              />
            </div>

            <div>
              <Label className="mb-2 block">Category</Label>
              <Select value={formData.category} onValueChange={(v) => handleChange("category", v)}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${cat.color.replace('text-', 'bg-').split(' ')[0]}`}></span>
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label>Active (visible on website)</Label>
              <Switch
                checked={formData.active}
                onCheckedChange={(v) => handleChange("active", v)}
                data-testid="switch-active"
              />
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full bg-primary hover:bg-primary/90 text-white mt-4"
              data-testid="save-faq-btn"
            >
              {editingItem ? "Update FAQ" : "Add FAQ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FAQManage;
