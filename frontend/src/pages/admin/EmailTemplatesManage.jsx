import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Mail, Code, Eye, Save, Type, Bold, Italic, Link, Image, List } from "lucide-react";
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

const EmailTemplatesManage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editorTab, setEditorTab] = useState("visual"); // visual or code
  
  // Visual editor fields
  const [visualContent, setVisualContent] = useState({
    greeting: "Dear {{client_name}},",
    intro: "Thank you for booking with us! We're excited to capture your special moments.",
    showDetails: true,
    bodyText: "We'll be in touch soon with more details about your session.",
    closing: "With love,",
    signature: "{{business_name}}",
    primaryColor: "#c6a87c",
    backgroundColor: "#f8f6f3",
  });
  
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    html_content: "",
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

  const handleVisualChange = (field, value) => {
    setVisualContent((prev) => ({ ...prev, [field]: value }));
  };

  // Generate HTML from visual editor content
  const generateHtmlFromVisual = () => {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: ${visualContent.backgroundColor}; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: ${visualContent.primaryColor}; padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px; color: #333; line-height: 1.6; }
    .content p { margin: 0 0 15px 0; }
    .details { background: ${visualContent.backgroundColor}; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .details p { margin: 8px 0; color: #666; }
    .details strong { color: #2d2a26; }
    .footer { padding: 20px 30px; background: ${visualContent.backgroundColor}; text-align: center; font-size: 12px; color: #999; }
    .button { display: inline-block; background: ${visualContent.primaryColor}; color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Silwer Lining Photography</h1>
    </div>
    <div class="content">
      <p>${visualContent.greeting}</p>
      <p>${visualContent.intro}</p>
      ${visualContent.showDetails ? `
      <div class="details">
        <p><strong>Session Type:</strong> {{session_type}}</p>
        <p><strong>Package:</strong> {{package_name}}</p>
        <p><strong>Date:</strong> {{booking_date}}</p>
        <p><strong>Time:</strong> {{booking_time}}</p>
        <p><strong>Total:</strong> R{{total_price}}</p>
      </div>
      ` : ''}
      <p>${visualContent.bodyText}</p>
      <p>${visualContent.closing}<br/>${visualContent.signature}</p>
    </div>
    <div class="footer">
      <p>{{business_email}} | {{business_phone}}</p>
    </div>
  </div>
</body>
</html>`;
  };

  // Parse HTML back to visual content (basic parsing)
  const parseHtmlToVisual = (html) => {
    // Extract primary color
    const colorMatch = html.match(/\.header\s*{\s*background:\s*(#[a-fA-F0-9]{6})/);
    const bgMatch = html.match(/body\s*{\s*[^}]*background-color:\s*(#[a-fA-F0-9]{6})/);
    
    // Try to extract content sections
    const greetingMatch = html.match(/<div class="content">\s*<p>([^<]+)<\/p>/);
    const closingMatch = html.match(/<p>([^<]+)<br\s*\/?>([^<]+)<\/p>\s*<\/div>\s*<div class="footer">/);
    
    setVisualContent(prev => ({
      ...prev,
      primaryColor: colorMatch?.[1] || prev.primaryColor,
      backgroundColor: bgMatch?.[1] || prev.backgroundColor,
      greeting: greetingMatch?.[1] || prev.greeting,
      closing: closingMatch?.[1] || prev.closing,
      signature: closingMatch?.[2] || prev.signature,
      showDetails: html.includes('class="details"'),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.subject) {
      toast.error("Please fill in template type and subject");
      return;
    }

    // Generate HTML content based on editor mode
    let finalHtmlContent = formData.html_content;
    if (editorTab === "visual" && !formData.use_raw_html) {
      finalHtmlContent = generateHtmlFromVisual();
    }

    if (!finalHtmlContent) {
      toast.error("Please add email content");
      return;
    }

    const token = localStorage.getItem("admin_token");
    const payload = {
      ...formData,
      html_content: finalHtmlContent,
      use_raw_html: editorTab === "code",
    };

    try {
      if (editingItem) {
        await axios.put(`${API}/admin/email-templates/${editingItem.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Template updated");
      } else {
        await axios.post(`${API}/admin/email-templates`, payload, {
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
    
    if (item.use_raw_html) {
      setEditorTab("code");
    } else {
      setEditorTab("visual");
      parseHtmlToVisual(item.html_content);
    }
    
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      subject: "",
      html_content: "",
      use_raw_html: false,
      active: true,
    });
    setVisualContent({
      greeting: "Dear {{client_name}},",
      intro: "Thank you for booking with us! We're excited to capture your special moments.",
      showDetails: true,
      bodyText: "We'll be in touch soon with more details about your session.",
      closing: "With love,",
      signature: "{{business_name}}",
      primaryColor: "#c6a87c",
      backgroundColor: "#f8f6f3",
    });
    setEditorTab("visual");
  };

  const insertVariable = (variable) => {
    if (editorTab === "code") {
      const textarea = document.getElementById("html-content-editor");
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = formData.html_content;
        const newText = text.substring(0, start) + variable + text.substring(end);
        handleChange("html_content", newText);
      }
    } else {
      // In visual mode, append to body text
      setVisualContent(prev => ({
        ...prev,
        bodyText: prev.bodyText + " " + variable
      }));
    }
  };

  const getPreviewHtml = () => {
    let html = editorTab === "visual" ? generateHtmlFromVisual() : formData.html_content;
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
                      if (!template.use_raw_html) {
                        parseHtmlToVisual(template.html_content);
                      }
                      setEditorTab(template.use_raw_html ? "code" : "visual");
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
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Email Template" : "Create Email Template"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Template Type & Subject */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div>
                <Label className="mb-2 block">Email Subject *</Label>
                <Input
                  placeholder="e.g., Your Booking is Confirmed! 📸"
                  value={formData.subject}
                  onChange={(e) => handleChange("subject", e.target.value)}
                  data-testid="input-subject"
                />
              </div>
            </div>

            {/* Editor Tabs */}
            <Tabs value={editorTab} onValueChange={setEditorTab} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="visual" className="gap-2">
                    <Type className="w-4 h-4" />
                    Visual Editor
                  </TabsTrigger>
                  <TabsTrigger value="code" className="gap-2">
                    <Code className="w-4 h-4" />
                    HTML Code
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(v) => handleChange("active", v)}
                  />
                  <Label className="text-sm">Active</Label>
                </div>
              </div>

              {/* Visual Editor */}
              <TabsContent value="visual" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Editor Form */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="mb-2 block text-sm">Primary Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={visualContent.primaryColor}
                            onChange={(e) => handleVisualChange("primaryColor", e.target.value)}
                            className="w-12 h-10 p-1 cursor-pointer"
                          />
                          <Input
                            value={visualContent.primaryColor}
                            onChange={(e) => handleVisualChange("primaryColor", e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="mb-2 block text-sm">Background Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={visualContent.backgroundColor}
                            onChange={(e) => handleVisualChange("backgroundColor", e.target.value)}
                            className="w-12 h-10 p-1 cursor-pointer"
                          />
                          <Input
                            value={visualContent.backgroundColor}
                            onChange={(e) => handleVisualChange("backgroundColor", e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm">Greeting</Label>
                      <Input
                        value={visualContent.greeting}
                        onChange={(e) => handleVisualChange("greeting", e.target.value)}
                        placeholder="Dear {{client_name}},"
                      />
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm">Introduction</Label>
                      <Textarea
                        value={visualContent.intro}
                        onChange={(e) => handleVisualChange("intro", e.target.value)}
                        rows={2}
                        placeholder="Thank you for booking with us!"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={visualContent.showDetails}
                        onCheckedChange={(v) => handleVisualChange("showDetails", v)}
                      />
                      <Label className="text-sm">Include booking details box</Label>
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm">Body Text</Label>
                      <Textarea
                        value={visualContent.bodyText}
                        onChange={(e) => handleVisualChange("bodyText", e.target.value)}
                        rows={3}
                        placeholder="We'll be in touch soon..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="mb-2 block text-sm">Closing</Label>
                        <Input
                          value={visualContent.closing}
                          onChange={(e) => handleVisualChange("closing", e.target.value)}
                          placeholder="With love,"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-sm">Signature</Label>
                        <Input
                          value={visualContent.signature}
                          onChange={(e) => handleVisualChange("signature", e.target.value)}
                          placeholder="{{business_name}}"
                        />
                      </div>
                    </div>

                    {/* Variables Quick Insert */}
                    <div className="bg-warm-sand rounded-lg p-3">
                      <Label className="text-sm mb-2 block">Quick Insert Variables</Label>
                      <div className="flex flex-wrap gap-1">
                        {variablesList.slice(0, 6).map((item) => (
                          <button
                            key={item.var}
                            onClick={() => insertVariable(item.var)}
                            className="text-xs bg-white px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                            title={item.desc}
                          >
                            {item.var}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div>
                    <Label className="mb-2 block text-sm">Live Preview</Label>
                    <div 
                      className="border rounded-lg overflow-hidden bg-gray-100 h-[450px] overflow-y-auto"
                      style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '118%' }}
                    >
                      <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Code Editor */}
              <TabsContent value="code" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <Label className="mb-2 block text-sm">HTML Code</Label>
                    <Textarea
                      id="html-content-editor"
                      value={formData.html_content}
                      onChange={(e) => handleChange("html_content", e.target.value)}
                      rows={20}
                      className="font-mono text-sm"
                      placeholder="Paste your full HTML email template here..."
                      data-testid="input-html-content"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="bg-warm-sand rounded-lg p-4">
                      <h4 className="font-semibold text-sm mb-3">Available Variables</h4>
                      <p className="text-xs text-muted-foreground mb-3">Click to insert at cursor</p>
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
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                Full Preview
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 bg-primary hover:bg-primary/90 text-white gap-2"
                data-testid="save-template-btn"
              >
                <Save className="w-4 h-4" />
                {editingItem ? "Update Template" : "Create Template"}
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
            <div className="bg-gray-100 p-3 rounded-t-lg text-sm border-b">
              <p><strong>To:</strong> jane@example.com</p>
              <p><strong>Subject:</strong> {formData.subject || "No subject"}</p>
            </div>
            <div 
              className="border rounded-b-lg bg-white overflow-hidden"
              dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplatesManage;
