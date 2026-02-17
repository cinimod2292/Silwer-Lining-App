import { useState, useEffect } from "react";
import { Plus, Trash2, Star, MessageSquare, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
];

const TestimonialsManage = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_name: "",
    session_type: "",
    content: "",
    rating: 5,
    image_url: "",
  });

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const fetchTestimonials = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/testimonials`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTestimonials(res.data);
    } catch (e) {
      toast.error("Failed to fetch testimonials");
    } finally {
      setLoading(false);
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
      await axios.post(`${API}/admin/testimonials`, formData, {
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
      toast.success(approved ? "Testimonial hidden" : "Testimonial approved");
      fetchTestimonials();
    } catch (e) {
      toast.error("Failed to update testimonial");
    }
  };

  const deleteTestimonial = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/testimonials/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Testimonial deleted");
      fetchTestimonials();
    } catch (e) {
      toast.error("Failed to delete testimonial");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="testimonials-manage">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">
          Manage Testimonials
        </h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2" data-testid="add-testimonial-btn">
              <Plus className="w-4 h-4" />
              Add Testimonial
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Testimonial</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="mb-2 block">Client Name *</Label>
                <Input
                  placeholder="Client's name"
                  value={formData.client_name}
                  onChange={(e) => handleChange("client_name", e.target.value)}
                  data-testid="input-client-name"
                />
              </div>
              <div>
                <Label className="mb-2 block">Session Type *</Label>
                <Select value={formData.session_type} onValueChange={(v) => handleChange("session_type", v)}>
                  <SelectTrigger data-testid="select-session-type">
                    <SelectValue placeholder="Select session type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Testimonial *</Label>
                <Textarea
                  placeholder="What did they say about their experience?"
                  value={formData.content}
                  onChange={(e) => handleChange("content", e.target.value)}
                  rows={4}
                  data-testid="input-content"
                />
              </div>
              <div>
                <Label className="mb-2 block">Rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleChange("rating", star)}
                      className="p-1"
                      data-testid={`star-${star}`}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= formData.rating
                            ? "fill-primary text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Photo URL (Optional)</Label>
                <Input
                  placeholder="https://..."
                  value={formData.image_url}
                  onChange={(e) => handleChange("image_url", e.target.value)}
                  data-testid="input-image-url"
                />
              </div>
              <Button
                onClick={handleSubmit}
                className="w-full bg-primary hover:bg-primary/90 text-white"
                data-testid="save-testimonial-btn"
              >
                Add Testimonial
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {testimonials.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No testimonials yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className={`bg-white rounded-xl shadow-soft p-6 ${
                !testimonial.approved ? "opacity-60" : ""
              }`}
              data-testid={`testimonial-${testimonial.id}`}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {testimonial.image_url && (
                  <img
                    src={testimonial.image_url}
                    alt={testimonial.client_name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{testimonial.client_name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {testimonial.session_type} Session
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-foreground/80 italic">"{testimonial.content}"</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      testimonial.approved
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {testimonial.approved ? "Visible" : "Hidden"}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleApproval(testimonial.id, testimonial.approved)}
                        className={testimonial.approved ? "text-yellow-600" : "text-green-600"}
                        data-testid={`toggle-${testimonial.id}`}
                      >
                        {testimonial.approved ? (
                          <>
                            <X className="w-4 h-4 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-red-500"
                            data-testid={`delete-${testimonial.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Testimonial?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the testimonial from {testimonial.client_name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTestimonial(testimonial.id)}
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestimonialsManage;
