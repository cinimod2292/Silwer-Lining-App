import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import {
  Save, Plus, Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered,
  Heading1, Heading2, Heading3, Undo, Redo, Check,
  PenTool, Calendar, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  { id: "initials", name: "Initials Box", icon: Check, color: "bg-yellow-100 border-yellow-300 text-yellow-800" },
  { id: "signature", name: "Signature Field", icon: PenTool, color: "bg-purple-100 border-purple-300 text-purple-800" },
  { id: "date", name: "Date (Auto-filled)", icon: Calendar, color: "bg-blue-100 border-blue-300 text-blue-800" },
];

const MenuBar = ({ editor }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-gray-50">
      <Button variant="ghost" size="sm"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}>
        <Undo className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}>
        <Redo className="w-4 h-4" />
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

  const contractDataRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: "Start typing your contract here..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "",
  });

  /* =========================
     FETCH CONTRACT
  ========================== */

  const fetchContract = useCallback(async () => {
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
  }, [editor]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  useEffect(() => {
    if (editor && contractDataRef.current !== null && !loading) {
      editor.commands.setContent(contractDataRef.current);
      contractDataRef.current = null;
    }
  }, [editor, loading]);

  /* =========================
     SAVE CONTRACT
  ========================== */

  const handleSave = useCallback(async () => {
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
    } catch {
      toast.error("Failed to save contract");
    } finally {
      setSaving(false);
    }
  }, [editor, contractTitle, smartFields]);

  /* =========================
     AUTO SAVE
  ========================== */

  const autoSaveContract = useCallback(async (fields) => {
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
  }, [editor, contractTitle]);

  /* =========================
     INSERT FIELD
  ========================== */

  const insertSmartField = useCallback((fieldType, label) => {
    if (!editor || !label.trim()) return;

    const fieldId = label.toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    if (smartFields.some(f => f.id === fieldId)) {
      toast.error("Field already exists");
      return;
    }

    const newField = {
      id: fieldId,
      type: fieldType,
      label,
      required: true,
    };

    editor.chain().focus().insertContent(` {{${fieldId}}} `).run();

    const updated = [...smartFields, newField];
    setSmartFields(updated);
    autoSaveContract(updated);

    setShowAddFieldModal(false);
    setNewFieldLabel("");
    toast.success("Field added");
  }, [editor, smartFields, autoSaveContract]);

  /* =========================
     REMOVE FIELD
  ========================== */

  const removeSmartField = useCallback((fieldId) => {
    setSmartFields(prev => prev.filter(f => f.id !== fieldId));

    if (editor) {
      const updated = editor.getHTML()
        .replace(new RegExp(`\\{\\{${fieldId}\\}\\}`, "g"), "");
      editor.commands.setContent(updated);
    }

    toast.success("Field removed");
  }, [editor]);

  /* =========================
     PREVIEW RENDER
  ========================== */

  const getDisplayContent = useCallback(() => {
    if (!editor) return "";

    let content = editor.getHTML();

    smartFields.forEach(field => {
      const placeholder = `{{${field.id}}}`;
      content = content.replace(
        new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"),
        `<span class="font-semibold text-primary">${field.label}</span>`
      );
    });

    return content;
  }, [editor, smartFields]);

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-semibold">Contract Editor</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Contract"}
        </Button>
      </div>

      <Input
        value={contractTitle}
        onChange={(e) => setContractTitle(e.target.value)}
        className="mb-4"
      />

      <MenuBar editor={editor} />
      <EditorContent editor={editor} />

      <div className="mt-6 border p-4 rounded">
        <h2 className="font-semibold mb-2">Live Preview</h2>
        <div dangerouslySetInnerHTML={{ __html: getDisplayContent() }} />
      </div>

      <Dialog open={showAddFieldModal} onOpenChange={setShowAddFieldModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Field</DialogTitle>
          </DialogHeader>

          <Input
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFieldModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => insertSmartField(newFieldType, newFieldLabel)}>
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractManage;
