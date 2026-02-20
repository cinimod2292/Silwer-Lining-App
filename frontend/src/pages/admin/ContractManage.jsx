import { useState, useEffect, useRef } from "react";
import { FileText, Plus, Trash2, Save, Eye, GripVertical, Type, Check, PenTool, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const smartFieldTypes = [
  { id: "agree_disagree", name: "Agree/Disagree Checkbox", icon: Check, description: "Client must check to agree" },
  { id: "initials", name: "Initials Box", icon: Type, description: "Client enters their initials" },
  { id: "signature", name: "Signature (Draw)", icon: PenTool, description: "Client draws signature" },
  { id: "date", name: "Date (Auto-filled)", icon: Calendar, description: "Automatically fills with signing date" },
];

const ContractManage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contract, setContract] = useState({
    title: "Photography Session Contract",
    content: "",
    smart_fields: [],
  });
  const [activeTab, setActiveTab] = useState("editor");
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newField, setNewField] = useState({
    type: "agree_disagree",
    label: "",
    required: true,
  });
  const textareaRef = useRef(null);

  useEffect(() => {
    fetchContract();
  }, []);

  const fetchContract = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/contract`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setContract(res.data);
    } catch (e) {
      console.error("Failed to fetch contract", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("admin_token");
    setSaving(true);
    try {
      await axios.put(`${API}/admin/contract`, contract, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Contract saved successfully");
    } catch (e) {
      toast.error("Failed to save contract");
    } finally {
      setSaving(false);
    }
  };

  const addSmartField = () => {
    if (!newField.label.trim()) {
      toast.error("Please enter a label for the field");
      return;
    }

    const fieldId = newField.label
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    // Check if field ID already exists
    if (contract.smart_fields.some((f) => f.id === fieldId)) {
      toast.error("A field with this label already exists");
      return;
    }

    const field = {
      id: fieldId,
      type: newField.type,
      label: newField.label,
      required: newField.required,
    };

    setContract((prev) => ({
      ...prev,
      smart_fields: [...prev.smart_fields, field],
    }));

    // Insert placeholder at cursor position or at end
    const placeholder = `{{${fieldId}}}`;
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent =
        contract.content.substring(0, start) +
        placeholder +
        contract.content.substring(end);
      setContract((prev) => ({ ...prev, content: newContent }));
    } else {
      setContract((prev) => ({
        ...prev,
        content: prev.content + "\n" + placeholder,
      }));
    }

    setNewField({ type: "agree_disagree", label: "", required: true });
    setShowAddFieldModal(false);
    toast.success(`Smart field "${newField.label}" added`);
  };

  const removeSmartField = (fieldId) => {
    // Remove from smart_fields array
    setContract((prev) => ({
      ...prev,
      smart_fields: prev.smart_fields.filter((f) => f.id !== fieldId),
      // Also remove placeholder from content
      content: prev.content.replace(new RegExp(`\\{\\{${fieldId}\\}\\}`, "g"), ""),
    }));
    toast.success("Smart field removed");
  };

  const insertFieldPlaceholder = (fieldId) => {
    const placeholder = `{{${fieldId}}}`;
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent =
        contract.content.substring(0, start) +
        placeholder +
        contract.content.substring(end);
      setContract((prev) => ({ ...prev, content: newContent }));
      
      // Focus back on textarea
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    }
  };

  const renderPreview = () => {
    let previewContent = contract.content;

    // Replace smart field placeholders with visual representations
    contract.smart_fields.forEach((field) => {
      const placeholder = `{{${field.id}}}`;
      let replacement = "";

      switch (field.type) {
        case "agree_disagree":
          replacement = `<div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px;">
            <input type="checkbox" disabled /> <span style="font-weight: 500;">${field.label}</span>
          </div>`;
          break;
        case "initials":
          replacement = `<div style="display: inline-block; padding: 8px 16px; background: #fefce8; border: 1px solid #fde047; border-radius: 6px;">
            <span style="font-style: italic; color: #854d0e;">Initials: </span>
            <span style="border-bottom: 2px solid #000; padding: 0 20px; font-family: cursive;">___</span>
          </div>`;
          break;
        case "signature":
          replacement = `<div style="display: block; padding: 20px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; text-align: center; margin: 10px 0;">
            <span style="color: #64748b;">✍️ ${field.label} - Draw Signature Here</span>
          </div>`;
          break;
        case "date":
          replacement = `<div style="display: inline-block; padding: 8px 16px; background: #eff6ff; border: 1px solid #93c5fd; border-radius: 6px;">
            <span style="color: #1e40af;">📅 ${new Date().toLocaleDateString()}</span>
          </div>`;
          break;
        default:
          replacement = `[${field.label}]`;
      }

      previewContent = previewContent.replace(
        new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"),
        replacement
      );
    });

    return previewContent;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="contract-manage">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Contract Editor
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage your booking contract with smart fields
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
          data-testid="save-contract-btn"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Contract"}
        </Button>
      </div>

      {/* Contract Title */}
      <div className="bg-white rounded-xl shadow-soft p-6 mb-6">
        <Label className="mb-2 block">Contract Title</Label>
        <Input
          value={contract.title}
          onChange={(e) => setContract((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Photography Session Contract"
          className="max-w-md"
          data-testid="contract-title-input"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Smart Fields Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-soft p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Smart Fields</h2>
              <Button
                onClick={() => setShowAddFieldModal(true)}
                size="sm"
                variant="outline"
                className="gap-1"
                data-testid="add-field-btn"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Click a field to insert its placeholder at cursor position
            </p>

            <div className="space-y-2">
              {contract.smart_fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No smart fields added yet
                </p>
              ) : (
                contract.smart_fields.map((field) => {
                  const fieldType = smartFieldTypes.find((t) => t.id === field.type);
                  const Icon = fieldType?.icon || FileText;
                  return (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 p-2 bg-warm-sand/30 rounded-lg group"
                    >
                      <button
                        onClick={() => insertFieldPlaceholder(field.id)}
                        className="flex-1 flex items-center gap-2 text-left hover:bg-primary/10 rounded p-1 transition-colors"
                        title="Click to insert at cursor"
                      >
                        <Icon className="w-4 h-4 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{field.label}</p>
                          <p className="text-xs text-muted-foreground">{fieldType?.name}</p>
                        </div>
                      </button>
                      <Button
                        onClick={() => removeSmartField(field.id)}
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                <strong>Tip:</strong> Use placeholders like <code className="bg-gray-100 px-1 rounded">{"{{FIELD_ID}}"}</code> in your content
              </p>
            </div>
          </div>
        </div>

        {/* Editor / Preview */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-soft">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b px-6 pt-4">
                <TabsList className="bg-transparent p-0 h-auto">
                  <TabsTrigger
                    value="editor"
                    className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-t-lg border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Editor
                  </TabsTrigger>
                  <TabsTrigger
                    value="preview"
                    className="px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-t-lg border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="editor" className="p-6 mt-0">
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">HTML Supported</p>
                    <p>Use HTML tags for formatting: &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;, &lt;li&gt;, etc.</p>
                  </div>
                </div>
                <Textarea
                  ref={textareaRef}
                  value={contract.content}
                  onChange={(e) => setContract((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter your contract content here. Use HTML for formatting and {{FIELD_ID}} placeholders for smart fields."
                  className="min-h-[500px] font-mono text-sm"
                  data-testid="contract-content-input"
                />
              </TabsContent>

              <TabsContent value="preview" className="p-6 mt-0">
                <div className="border rounded-lg p-6 bg-white min-h-[500px]">
                  <h2 className="text-2xl font-display text-center mb-6 pb-4 border-b-2 border-primary/30">
                    {contract.title}
                  </h2>
                  <div
                    className="prose prose-sm max-w-none contract-preview"
                    dangerouslySetInnerHTML={{ __html: renderPreview() }}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Add Smart Field Modal */}
      <Dialog open={showAddFieldModal} onOpenChange={setShowAddFieldModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Smart Field</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Field Type</Label>
              <Select
                value={newField.type}
                onValueChange={(val) => setNewField((prev) => ({ ...prev, type: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {smartFieldTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        <span>{type.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {smartFieldTypes.find((t) => t.id === newField.type)?.description}
              </p>
            </div>

            <div>
              <Label className="mb-2 block">Field Label</Label>
              <Input
                value={newField.label}
                onChange={(e) => setNewField((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g., I agree to the terms"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This label will be shown to the client
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFieldModal(false)}>
              Cancel
            </Button>
            <Button onClick={addSmartField}>Add Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .contract-preview h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #2D2A26;
        }
        .contract-preview h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #2D2A26;
        }
        .contract-preview p {
          margin-bottom: 0.75rem;
          line-height: 1.7;
        }
        .contract-preview ul, .contract-preview ol {
          margin-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .contract-preview li {
          margin-bottom: 0.25rem;
        }
      `}</style>
    </div>
  );
};

export default ContractManage;
