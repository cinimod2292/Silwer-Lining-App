import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Mail, Code, Eye, Save } from "lucide-react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const templateTypes = [
  { id: "booking_confirmation", name: "Booking Confirmation", description: "Sent when a new booking is made" },
  { id: "booking_reminder", name: "Booking Reminder", description: "Sent before the session date" },
  { id: "booking_cancellation", name: "Booking Cancellation", description: "Sent when a booking is cancelled" },
  { id: "booking_rescheduled", name: "Booking Rescheduled", description: "Sent when a booking is rescheduled" },
  { id: "payment_received", name: "Payment Received", description: "Sent when payment is confirmed" },
  { id: "gallery_ready", name: "Gallery Ready", description: "Sent when photos are ready for viewing" },
];

const variablesList = [
  { var: "{{client_name}}", desc: "Client's full name" },
  { var: "{{client_email}}", desc: "Client's email" },
  { var: "{{session_type}}", desc: "Type of session" },
  { var: "{{package_name}}", desc: "Selected package" },
  { var: "{{booking_date}}", desc: "Session date" },
  { var: "{{booking_time}}", desc: "Session time" },
  { var: "{{total_price}}", desc: "Total booking price" },
  { var: "{{business_name}}", desc: "Your business name" },
  { var: "{{business_email}}", desc: "Your contact email" },
  { var: "{{business_phone}}", desc: "Your phone number" },
];

const defaultHtmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8f6f3; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }
    .header { background: #c6a87c; padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .content h2 { color: #2d2a26; margin-top: 0; }
    .details { background: #f8f6f3; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .details p { margin: 8px 0; color: #666; }
    .details strong { color: #2d2a26; }
    .footer { padding: 20px 30px; background: #f8f6f3; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Silwer Lining Photography</h1>
    </div>
    <div class="content">
      <h2>Booking Confirmed!</h2>
      <p>Dear {{client_name}},</p>
      <p>Thank you for booking with us! We're excited to capture your special moments.</p>
      
      <div class="details">
        <p><strong>Session Type:</strong> {{session_type}}</p>
        <p><strong>Package:</strong> {{package_name}}</p>
        <p><strong>Date:</strong> {{booking_date}}</p>
        <p><strong>Time:</strong> {{booking_time}}</p>
        <p><strong>Total:</strong> R{{total_price}}</p>
      </div>
      
      <p>We'll be in touch soon with more details about your session.</p>
      <p>With love,<br/>{{business_name}}</p>
    </div>
    <div class="footer">
      <p>{{business_email}} | {{business_phone}}</p>
    </div>
  </div>
</body>
</html>`;

const EmailTemplatesManage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("visual"); // visual or raw
  
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    html_content: defaultHtmlTemplate,
    use_raw_html: false,
    active: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/email-templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates(res.data);
    } catch (e) {
      toast.error("Failed to fetch templates");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.subject || !formData.html_content) {
      toast.error("Please fill in all required fields");
      return;
    }

    const token = localStorage.getItem("admin_token");
    try {
      if (editingItem) {
        await axios.put(`${API}/admin/email-templates/${editingItem.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Template updated");
      } else {
        await axios.post(`${API}/admin/email-templates`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Template created");
      }
      setDialogOpen(false);
      resetForm();
      fetchTemplates();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save template");
    }
  };

  const deleteTemplate = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/email-templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Template deleted");
      fetchTemplates();
    } catch (e) {
      toast.error("Failed to delete template");
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      subject: item.subject,
      html_content: item.html_content,
      use_raw_html: item.use_raw_html,
      active: item.active,
    });
    setEditorMode(item.use_raw_html ? "raw" : "visual");
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      subject: "",
      html_content: defaultHtmlTemplate,
      use_raw_html: false,
      active: true,
    });
    setEditorMode("visual");
  };

  const insertVariable = (variable) => {
    const textarea = document.getElementById("html-content-editor");
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.html_content;
      const newText = text.substring(0, start) + variable + text.substring(end);
      handleChange("html_content", newText);
    }
  };

  const getPreviewHtml = () => {
    let html = formData.html_content;
    // Replace variables with sample data
    html = html.replace(/\{\{client_name\}\}/g, "Jane Smith");
    html = html.replace(/\{\{client_email\}\}/g, "jane@example.com");
    html = html.replace(/\{\{session_type\}\}/g, "Maternity");
    html = html.replace(/\{\{package_name\}\}/g, "Signature");
    html = html.replace(/\{\{booking_date\}\}/g, "March 15, 2026");
    html = html.replace(/\{\{booking_time\}\}/g, "10:00 AM");
    html = html.replace(/\{\{total_price\}\}/g, "5,500");
    html = html.replace(/\{\{business_name\}\}/g, "Silwer Lining Photography");
    html = html.replace(/\{\{business_email\}\}/g, "info@silwerlining.co.za");
    html = html.replace(/\{\{business_phone\}\}/g, "063 699 9703");
    return html;
  };

  const getTemplateTypeName = (name) => {
    const type = templateTypes.find(t => t.id === name);
    return type?.name || name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="email-templates-manage">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Email Templates
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customize the emails sent to your clients
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
          data-testid="add-template-btn"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </Button>
      </div>

      {/* Existing Templates */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No email templates yet.</p>
          <p className="text-sm text-muted-foreground">Create templates for booking confirmations, reminders, and more.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`bg-white rounded-xl shadow-soft p-6 ${!template.active ? "opacity-60" : ""}`}
              data-testid={`template-${template.id}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">{getTemplateTypeName(template.name)}</h3>
                    {!template.active && (
                      <span className="bg-gray-400 text-white text-xs px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                    {template.use_raw_html && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Code className="w-3 h-3" />
                        Raw HTML
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Subject:</strong> {template.subject}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFormData({ ...template });
                      setPreviewOpen(true);
                    }}
                    data-testid={`preview-${template.id}`}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(template)}
                    data-testid={`edit-${template.id}`}
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
                        data-testid={`delete-${template.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the "{getTemplateTypeName(template.name)}" template.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteTemplate(template.id)}
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

      {/* Template Types Reference */}
      <div className="mt-8 bg-white rounded-xl shadow-soft p-6">
        <h3 className="font-semibold mb-4">Available Template Types</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templateTypes.map((type) => {
            const exists = templates.some(t => t.name === type.id);
            return (
              <div key={type.id} className={`p-3 rounded-lg ${exists ? "bg-green-50 border border-green-200" : "bg-warm-sand"}`}>
                <p className="font-medium text-sm">{type.name}</p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
                {exists && <p className="text-xs text-green-600 mt-1">✓ Created</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Email Template" : "Create Email Template"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
            {/* Left Column - Form */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">Template Type *</Label>
                  <Select value={formData.name} onValueChange={(v) => handleChange("name", v)}>
                    <SelectTrigger data-testid="select-template-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {templateTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.active}
                      onCheckedChange={(v) => handleChange("active", v)}
                    />
                    <Label>Active</Label>
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Email Subject *</Label>
                <Input
                  placeholder="e.g., Your Booking is Confirmed! 📸"
                  value={formData.subject}
                  onChange={(e) => handleChange("subject", e.target.value)}
                  data-testid="input-subject"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Email Content *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Raw HTML Mode</span>
                    <Switch
                      checked={formData.use_raw_html}
                      onCheckedChange={(v) => {
                        handleChange("use_raw_html", v);
                        setEditorMode(v ? "raw" : "visual");
                      }}
                    />
                  </div>
                </div>
                <Textarea
                  id="html-content-editor"
                  placeholder="Enter your email HTML content..."
                  value={formData.html_content}
                  onChange={(e) => handleChange("html_content", e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                  data-testid="input-html-content"
                />
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full bg-primary hover:bg-primary/90 text-white"
                data-testid="save-template-btn"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingItem ? "Update Template" : "Create Template"}
              </Button>
            </div>

            {/* Right Column - Variables & Preview */}
            <div className="space-y-4">
              <div className="bg-warm-sand rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-3">Available Variables</h4>
                <p className="text-xs text-muted-foreground mb-3">Click to insert at cursor position</p>
                <div className="space-y-2">
                  {variablesList.map((item) => (
                    <button
                      key={item.var}
                      onClick={() => insertVariable(item.var)}
                      className="w-full text-left p-2 rounded bg-white hover:bg-primary/5 transition-colors"
                    >
                      <code className="text-xs text-primary">{item.var}</code>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="bg-gray-100 p-2 rounded-t-lg text-sm">
              <strong>Subject:</strong> {formData.subject}
            </div>
            <div 
              className="border rounded-b-lg bg-white"
              dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplatesManage;
