import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import {
  Save, Plus, Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered,
  Heading1, Heading2, Heading3, Undo, Redo, Check, Type, 
  PenTool, Calendar, Trash2, GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const smartFieldTypes = [
  { id: "agree_disagree", name: "Agree/Disagree Checkbox", icon: Check, color: "bg-green-100 border-green-300 text-green-800" },
  { id: "initials", name: "Initials Box", icon: Type, color: "bg-yellow-100 border-yellow-300 text-yellow-800" },
  { id: "signature", name: "Signature Field", icon: PenTool, color: "bg-purple-100 border-purple-300 text-purple-800" },
  { id: "date", name: "Date (Auto-filled)", icon: Calendar, color: "bg-blue-100 border-blue-300 text-blue-800" },
];

// Menu bar component
const MenuBar = ({ editor }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-gray-50">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className="h-8 w-8 p-0"
        title="Undo"
      >
        <Undo className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className="h-8 w-8 p-0"
        title="Redo"
      >
        <Redo className="w-4 h-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`h-8 w-8 p-0 ${editor.isActive("heading", { level: 1 }) ? "bg-primary/20" : ""}`}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`h-8 w-8 p-0 ${editor.isActive("heading", { level: 2 }) ? "bg-primary/20" : ""}`}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`h-8 w-8 p-0 ${editor.isActive("heading", { level: 3 }) ? "bg-primary/20" : ""}`}
        title="Heading 3"
      >
        <Heading3 className="w-4 h-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`h-8 w-8 p-0 ${editor.isActive("bold") ? "bg-primary/20" : ""}`}
        title="Bold"
      >
        <Bold className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`h-8 w-8 p-0 ${editor.isActive("italic") ? "bg-primary/20" : ""}`}
        title="Italic"
      >
        <Italic className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`h-8 w-8 p-0 ${editor.isActive("underline") ? "bg-primary/20" : ""}`}
        title="Underline"
      >
        <UnderlineIcon className="w-4 h-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: "left" }) ? "bg-primary/20" : ""}`}
        title="Align Left"
      >
        <AlignLeft className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: "center" }) ? "bg-primary/20" : ""}`}
        title="Align Center"
      >
        <AlignCenter className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: "right" }) ? "bg-primary/20" : ""}`}
        title="Align Right"
      >
        <AlignRight className="w-4 h-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`h-8 w-8 p-0 ${editor.isActive("bulletList") ? "bg-primary/20" : ""}`}
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`h-8 w-8 p-0 ${editor.isActive("orderedList") ? "bg-primary/20" : ""}`}
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </Button>
    </div>
  );
};

const ContractManage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contractTitle, setContractTitle] = useState("Photography Session Contract");
  const [smartFields, setSmartFields] = useState([]);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldType, setNewFieldType] = useState("agree_disagree");
  const [newFieldLabel, setNewFieldLabel] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: "Start typing your contract here...",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[500px] p-6",
      },
    },
  });

  useEffect(() => {
    fetchContract();
  }, []);

  const contractDataRef = useRef(null);

  const fetchContract = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/contract`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setContractTitle(res.data.title || "Photography Session Contract");
      setSmartFields(res.data.smart_fields || []);
      contractDataRef.current = res.data.content || "";
      
      if (editor) {
        editor.commands.setContent(res.data.content || "");
      }
    } catch (e) {
      console.error("Failed to fetch contract", e);
    } finally {
      setLoading(false);
    }
  };

  // Set editor content once editor is ready (only if data was fetched before editor initialized)
  useEffect(() => {
    if (editor && contractDataRef.current !== null && !loading) {
      editor.commands.setContent(contractDataRef.current);
      contractDataRef.current = null; // Only set once
    }
  }, [editor, loading]);

  const handleSave = async () => {
    if (!editor) return;
    
    const token = localStorage.getItem("admin_token");
    setSaving(true);
    try {
      await axios.put(
        `${API}/admin/contract`,
        {
          title: contractTitle,
          content: editor.getHTML(),
          smart_fields: smartFields,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Contract saved successfully");
    } catch (e) {
      toast.error("Failed to save contract");
    } finally {
      setSaving(false);
    }
  };

  const insertSmartField = (fieldType, label) => {
    if (!editor || !label.trim()) return;

    const fieldId = label
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    // Check for duplicates
    if (smartFields.some((f) => f.id === fieldId)) {
      toast.error("A field with this label already exists");
      return;
    }

    // Add to smart fields list
    const newField = {
      id: fieldId,
      type: fieldType,
      label: label,
      required: true,
    };
    
    // Insert visual placeholder in editor FIRST
    const placeholder = `{{${fieldId}}}`;
    editor.chain().focus().insertContent(` ${placeholder} `).run();
    
    // Then update state - use callback to ensure we get latest state
    setSmartFields((prev) => {
      const updated = [...prev, newField];
      // Auto-save after adding field to prevent loss
      setTimeout(() => {
        autoSaveContract(updated);
      }, 100);
      return updated;
    });

    setShowAddFieldModal(false);
    setNewFieldLabel("");
    toast.success(`"${label}" field added - auto-saving...`);
  };

  const autoSaveContract = async (fields) => {
    if (!editor) return;
    const token = localStorage.getItem("admin_token");
    try {
      await axios.put(
        `${API}/admin/contract`,
        {
          title: contractTitle,
          content: editor.getHTML(),
          smart_fields: fields,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      console.error("Auto-save failed", e);
    }
  };

  const removeSmartField = (fieldId) => {
    setSmartFields((prev) => prev.filter((f) => f.id !== fieldId));
    
    // Remove from editor content
    if (editor) {
      const currentContent = editor.getHTML();
      const updatedContent = currentContent.replace(
        new RegExp(`\\{\\{${fieldId}\\}\\}`, "g"),
        ""
      );
      editor.commands.setContent(updatedContent);
    }
    
    toast.success("Field removed");
  };

  const renderSmartFieldInline = (field) => {
    const fieldType = smartFieldTypes.find((t) => t.id === field.type);
    const Icon = fieldType?.icon || Check;
    
    return (
      <span
        key={field.id}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${fieldType?.color}`}
      >
        <Icon className="w-3 h-3" />
        {field.label}
      </span>
    );
  };

  // Convert placeholders to visual elements for display
  const getDisplayContent = () => {
    if (!editor) return "";
    
    let content = editor.getHTML();
    
    smartFields.forEach((field) => {
      const placeholder = `{{${field.id}}}`;
      const fieldType = smartFieldTypes.find((t) => t.id === field.type);
      
      let visual = "";
      switch (field.type) {
        case "agree_disagree":
          visual = `<span class="inline-flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm font-medium my-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            ${field.label}
          </span>`;
          break;
        case "initials":
          visual = `<span class="inline-flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm font-medium my-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            ${field.label}: ____
          </span>`;
          break;
        case "signature":
          visual = `<div class="block my-3 p-4 bg-purple-50 border-2 border-dashed border-purple-200 rounded-lg text-center text-purple-700">
            <svg class="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            <span class="text-sm font-medium">${field.label}</span>
          </div>`;
          break;
        case "date":
          visual = `<span class="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm font-medium my-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            ${new Date().toLocaleDateString()}
          </span>`;
          break;
      }
      
      content = content.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), visual);
    });
    
    return content;
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Contract Editor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create your booking contract - what you see is what clients will sign
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
      <div className="bg-white rounded-xl shadow-soft p-4 mb-4">
        <Label className="text-sm text-muted-foreground mb-1 block">Contract Title</Label>
        <Input
          value={contractTitle}
          onChange={(e) => setContractTitle(e.target.value)}
          className="text-xl font-semibold border-0 px-0 focus-visible:ring-0 shadow-none"
          placeholder="Photography Session Contract"
          data-testid="contract-title-input"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Smart Fields Sidebar */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-white rounded-xl shadow-soft p-4 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Smart Fields</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1 h-8" data-testid="add-field-dropdown">
                    <Plus className="w-4 h-4" />
                    Insert
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {smartFieldTypes.map((type) => (
                    <DropdownMenuItem
                      key={type.id}
                      onClick={() => {
                        setNewFieldType(type.id);
                        setShowAddFieldModal(true);
                      }}
                      className="gap-2"
                    >
                      <type.icon className="w-4 h-4" />
                      {type.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              Fields clients must complete when signing
            </p>

            {smartFields.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No fields yet</p>
                <p className="text-xs">Click "Insert" to add fields</p>
              </div>
            ) : (
              <div className="space-y-2">
                {smartFields.map((field) => {
                  const fieldType = smartFieldTypes.find((t) => t.id === field.type);
                  const Icon = fieldType?.icon || Check;
                  return (
                    <div
                      key={field.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border ${fieldType?.color} group`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium truncate">{field.label}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSmartField(field.id)}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* WYSIWYG Editor */}
        <div className="lg:col-span-3 order-1 lg:order-2">
          <div className="bg-white rounded-xl shadow-soft overflow-hidden">
            <MenuBar editor={editor} />
            
            {/* Insert Field Button in toolbar */}
            <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Insert:</span>
              {smartFieldTypes.map((type) => (
                <Button
                  key={type.id}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewFieldType(type.id);
                    setShowAddFieldModal(true);
                  }}
                  className={`h-7 text-xs gap-1 ${type.color} border hover:opacity-80`}
                >
                  <type.icon className="w-3 h-3" />
                  {type.name.split(" ")[0]}
                </Button>
              ))}
            </div>

            {/* Editor Area */}
            <div className="contract-editor">
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Preview Section */}
          <div className="mt-4 bg-white rounded-xl shadow-soft p-6">
            <h3 className="font-semibold mb-4 text-lg flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Live Preview
            </h3>
            <div className="border rounded-lg p-6 bg-warm-sand/20">
              <h2 className="text-2xl font-display text-center mb-6 pb-4 border-b-2 border-primary/30">
                {contractTitle}
              </h2>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: getDisplayContent() }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add Field Modal */}
      <Dialog open={showAddFieldModal} onOpenChange={setShowAddFieldModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {(() => {
                const type = smartFieldTypes.find((t) => t.id === newFieldType);
                const Icon = type?.icon || Check;
                return (
                  <>
                    <Icon className="w-5 h-5 text-primary" />
                    Add {type?.name}
                  </>
                );
              })()}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-2 block">Field Label</Label>
              <Input
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder={
                  newFieldType === "agree_disagree"
                    ? "e.g., I agree to the terms"
                    : newFieldType === "initials"
                    ? "e.g., Please initial here"
                    : newFieldType === "signature"
                    ? "e.g., Client Signature"
                    : "e.g., Date Signed"
                }
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    insertSmartField(newFieldType, newFieldLabel);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {newFieldType === "agree_disagree" && "Client must check this box to agree"}
                {newFieldType === "initials" && "Client will type their initials"}
                {newFieldType === "signature" && "Client will draw their signature"}
                {newFieldType === "date" && "Date will be auto-filled when signing"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFieldModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => insertSmartField(newFieldType, newFieldLabel)}>
              Insert Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .contract-editor .ProseMirror {
          min-height: 400px;
          padding: 1.5rem;
        }
        .contract-editor .ProseMirror:focus {
          outline: none;
        }
        .contract-editor .ProseMirror h1 {
          font-size: 1.75rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .contract-editor .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .contract-editor .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .contract-editor .ProseMirror p {
          margin-bottom: 0.75rem;
          line-height: 1.7;
        }
        .contract-editor .ProseMirror ul,
        .contract-editor .ProseMirror ol {
          margin-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .contract-editor .ProseMirror li {
          margin-bottom: 0.25rem;
        }
        .contract-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #adb5bd;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default ContractManage;
