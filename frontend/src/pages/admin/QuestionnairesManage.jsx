import { useState, useEffect } from "react";
import { 
  Plus, Trash2, GripVertical, Copy, Settings, Eye, Save,
  Type, AlignLeft, CircleDot, CheckSquare, ChevronDown, Calendar, Clock, Hash, Mail, Phone,
  ChevronUp, ChevronRight
} from "lucide-react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const sessionTypes = [
  { id: "maternity", name: "Maternity", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { id: "newborn", name: "Newborn", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "studio", name: "Studio Portraits", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { id: "family", name: "Family", color: "bg-green-100 text-green-700 border-green-200" },
  { id: "baby-birthday", name: "Baby Birthday", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { id: "adult-birthday", name: "Adult Birthday", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { id: "brand-product", name: "Brand/Product", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

const questionTypes = [
  { id: "text", name: "Short Answer", icon: Type, description: "Single line text" },
  { id: "textarea", name: "Paragraph", icon: AlignLeft, description: "Multi-line text" },
  { id: "radio", name: "Multiple Choice", icon: CircleDot, description: "Select one option" },
  { id: "checkbox", name: "Checkboxes", icon: CheckSquare, description: "Select multiple options" },
  { id: "dropdown", name: "Dropdown", icon: ChevronDown, description: "Select from a list" },
  { id: "date", name: "Date", icon: Calendar, description: "Date picker" },
  { id: "time", name: "Time", icon: Clock, description: "Time picker" },
  { id: "number", name: "Number", icon: Hash, description: "Numeric input" },
  { id: "email", name: "Email", icon: Mail, description: "Email address" },
  { id: "phone", name: "Phone", icon: Phone, description: "Phone number" },
];

const QuestionnairesManage = () => {
  const [activeSessionType, setActiveSessionType] = useState("maternity");
  const [questionnaire, setQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    fetchQuestionnaire(activeSessionType);
  }, [activeSessionType]);

  const fetchQuestionnaire = async (sessionType) => {
    const token = localStorage.getItem("admin_token");
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/questionnaires/${sessionType}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setQuestionnaire(res.data);
    } catch (e) {
      setQuestionnaire({
        session_type: sessionType,
        title: "",
        description: "",
        questions: [],
        active: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
  const token = localStorage.getItem("admin_token");
  setSaving(true);
  try {
    // Use PUT if questionnaire has an id, POST otherwise
    const endpoint = questionnaire?.id 
      ? `${API}/admin/questionnaires/${questionnaire.id}`
      : `${API}/admin/questionnaires`;
    
    const method = questionnaire?.id ? 'put' : 'post';
    
    await axios({
      method,
      url: endpoint,
      data: questionnaire,
      headers: { Authorization: `Bearer ${token}` },
    });
    
    toast.success("Questionnaire saved");
  } catch (e) {
    toast.error("Failed to save questionnaire");
    console.error(e);
  } finally {
    setSaving(false);
  }
};

  const addQuestion = (type = "text") => {
    const newQuestion = {
      id: `q_${Date.now()}`,
      type,
      label: "",
      description: "",
      required: false,
      options: type === "radio" || type === "checkbox" || type === "dropdown" 
        ? [{ id: `opt_${Date.now()}`, label: "Option 1", value: "" }]
        : [],
      placeholder: "",
      validation: {},
      order: questionnaire.questions.length,
    };
    
    setQuestionnaire(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
    
    // Expand the new question
    setExpandedQuestions(prev => ({ ...prev, [newQuestion.id]: true }));
  };

  const updateQuestion = (questionId, field, value) => {
    setQuestionnaire(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId ? { ...q, [field]: value } : q
      ),
    }));
  };

  const deleteQuestion = (questionId) => {
    setQuestionnaire(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId),
    }));
  };

  const duplicateQuestion = (question) => {
    const newQuestion = {
      ...question,
      id: `q_${Date.now()}`,
      label: `${question.label} (copy)`,
      order: questionnaire.questions.length,
    };
    setQuestionnaire(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
  };

  const addOption = (questionId) => {
    setQuestionnaire(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId) {
          return {
            ...q,
            options: [...q.options, { 
              id: `opt_${Date.now()}`, 
              label: `Option ${q.options.length + 1}`, 
              value: "" 
            }],
          };
        }
        return q;
      }),
    }));
  };

  const updateOption = (questionId, optionId, field, value) => {
    setQuestionnaire(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId) {
          return {
            ...q,
            options: q.options.map(opt =>
              opt.id === optionId ? { ...opt, [field]: value } : opt
            ),
          };
        }
        return q;
      }),
    }));
  };

  const deleteOption = (questionId, optionId) => {
    setQuestionnaire(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id === questionId) {
          return {
            ...q,
            options: q.options.filter(opt => opt.id !== optionId),
          };
        }
        return q;
      }),
    }));
  };

  const toggleExpanded = (questionId) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const moveQuestion = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= questionnaire.questions.length) return;
    
    const questions = [...questionnaire.questions];
    const [removed] = questions.splice(fromIndex, 1);
    questions.splice(toIndex, 0, removed);
    
    // Update order
    questions.forEach((q, i) => q.order = i);
    
    setQuestionnaire(prev => ({ ...prev, questions }));
  };

  const getQuestionTypeInfo = (type) => {
    return questionTypes.find(t => t.id === type) || questionTypes[0];
  };

  const getSessionTypeInfo = (id) => {
    return sessionTypes.find(t => t.id === id) || sessionTypes[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="questionnaires-manage">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">
            Session Questionnaires
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create custom intake forms for each session type
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            className="gap-2"
            disabled={!questionnaire?.questions?.length}
          >
            <Eye className="w-4 h-4" />
            Preview
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
            data-testid="save-questionnaire-btn"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Questionnaire"}
          </Button>
        </div>
      </div>

      {/* Session Type Tabs */}
      <Tabs value={activeSessionType} onValueChange={setActiveSessionType} className="mb-6">
        <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
          {sessionTypes.map((type) => (
            <TabsTrigger
              key={type.id}
              value={type.id}
              className={`px-4 py-2 rounded-lg border-2 transition-all data-[state=active]:border-primary data-[state=active]:bg-primary/5`}
              data-testid={`tab-${type.id}`}
            >
              {type.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-3 space-y-6">
          {/* Form Settings */}
          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-full text-sm ${getSessionTypeInfo(activeSessionType).color}`}>
                  {getSessionTypeInfo(activeSessionType).name}
                </div>
                <span className="text-muted-foreground text-sm">
                  {questionnaire?.questions?.length || 0} questions
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Active</Label>
                <Switch
                  checked={questionnaire?.active || false}
                  onCheckedChange={(v) => setQuestionnaire(prev => ({ ...prev, active: v }))}
                  data-testid="questionnaire-active"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Form Title (Optional)</Label>
                <Input
                  value={questionnaire?.title || ""}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={`${getSessionTypeInfo(activeSessionType).name} Session Questionnaire`}
                  data-testid="questionnaire-title"
                />
              </div>
              <div>
                <Label className="mb-2 block">Description (Optional)</Label>
                <Textarea
                  value={questionnaire?.description || ""}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Please fill out this form to help us prepare for your session..."
                  rows={2}
                  data-testid="questionnaire-description"
                />
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {questionnaire?.questions?.map((question, index) => {
              const typeInfo = getQuestionTypeInfo(question.type);
              const TypeIcon = typeInfo.icon;
              const isExpanded = expandedQuestions[question.id];
              
              return (
                <div
                  key={question.id}
                  className="bg-white rounded-xl shadow-soft overflow-hidden"
                  data-testid={`question-${question.id}`}
                >
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(question.id)}>
                    {/* Question Header */}
                    <div className="flex items-center gap-3 p-4 border-b bg-warm-sand/30">
                      <button className="cursor-grab text-muted-foreground hover:text-foreground">
                        <GripVertical className="w-5 h-5" />
                      </button>
                      <div className="flex items-center gap-2 flex-1">
                        <TypeIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium truncate">
                          {question.label || "Untitled Question"}
                        </span>
                        {question.required && (
                          <span className="text-red-500 text-sm">*</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground bg-white px-2 py-1 rounded">
                          {typeInfo.name}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveQuestion(index, index - 1)}
                          disabled={index === 0}
                          className="h-8 w-8"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveQuestion(index, index + 1)}
                          disabled={index === questionnaire.questions.length - 1}
                          className="h-8 w-8"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    {/* Question Editor */}
                    <CollapsibleContent>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="mb-2 block text-sm">Question Label *</Label>
                            <Input
                              value={question.label}
                              onChange={(e) => updateQuestion(question.id, "label", e.target.value)}
                              placeholder="Enter your question"
                            />
                          </div>
                          <div>
                            <Label className="mb-2 block text-sm">Question Type</Label>
                            <Select 
                              value={question.type} 
                              onValueChange={(v) => updateQuestion(question.id, "type", v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {questionTypes.map((type) => (
                                  <SelectItem key={type.id} value={type.id}>
                                    <div className="flex items-center gap-2">
                                      <type.icon className="w-4 h-4" />
                                      {type.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label className="mb-2 block text-sm">Help Text (Optional)</Label>
                          <Input
                            value={question.description}
                            onChange={(e) => updateQuestion(question.id, "description", e.target.value)}
                            placeholder="Additional instructions for this question"
                          />
                        </div>

                        {/* Options for radio, checkbox, dropdown */}
                        {["radio", "checkbox", "dropdown"].includes(question.type) && (
                          <div>
                            <Label className="mb-2 block text-sm">Options</Label>
                            <div className="space-y-2">
                              {question.options.map((option, optIndex) => (
                                <div key={option.id} className="flex items-center gap-2">
                                  <div className="w-6 flex justify-center">
                                    {question.type === "radio" && <CircleDot className="w-4 h-4 text-muted-foreground" />}
                                    {question.type === "checkbox" && <CheckSquare className="w-4 h-4 text-muted-foreground" />}
                                    {question.type === "dropdown" && <span className="text-sm text-muted-foreground">{optIndex + 1}.</span>}
                                  </div>
                                  <Input
                                    value={option.label}
                                    onChange={(e) => updateOption(question.id, option.id, "label", e.target.value)}
                                    placeholder={`Option ${optIndex + 1}`}
                                    className="flex-1"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => deleteOption(question.id, option.id)}
                                    disabled={question.options.length <= 1}
                                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addOption(question.id)}
                                className="mt-2"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Option
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Placeholder for text inputs */}
                        {["text", "textarea", "email", "phone", "number"].includes(question.type) && (
                          <div>
                            <Label className="mb-2 block text-sm">Placeholder Text</Label>
                            <Input
                              value={question.placeholder}
                              onChange={(e) => updateQuestion(question.id, "placeholder", e.target.value)}
                              placeholder="e.g., Enter your answer here..."
                            />
                          </div>
                        )}

                        {/* Question Actions */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={question.required}
                              onCheckedChange={(v) => updateQuestion(question.id, "required", v)}
                            />
                            <Label className="text-sm">Required</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => duplicateQuestion(question)}
                              className="text-muted-foreground"
                            >
                              <Copy className="w-4 h-4 mr-1" />
                              Duplicate
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteQuestion(question.id)}
                              className="text-muted-foreground hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}

            {/* Empty State */}
            {(!questionnaire?.questions || questionnaire.questions.length === 0) && (
              <div className="bg-white rounded-xl shadow-soft p-12 text-center">
                <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No questions yet</p>
                <p className="text-sm text-muted-foreground">
                  Add questions to create an intake form for {getSessionTypeInfo(activeSessionType).name} sessions
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Add Questions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-soft p-4 sticky top-4">
            <h3 className="font-semibold mb-4">Add Question</h3>
            <div className="space-y-2">
              {questionTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => addQuestion(type.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                  data-testid={`add-${type.id}-btn`}
                >
                  <type.icon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{type.name}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Form Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-6">
            {questionnaire?.title && (
              <div>
                <h2 className="font-display text-xl font-semibold">{questionnaire.title}</h2>
                {questionnaire.description && (
                  <p className="text-muted-foreground mt-1">{questionnaire.description}</p>
                )}
              </div>
            )}
            
            {questionnaire?.questions?.map((question) => {
              const typeInfo = getQuestionTypeInfo(question.type);
              
              return (
                <div key={question.id} className="space-y-2">
                  <Label className="flex items-center gap-1">
                    {question.label}
                    {question.required && <span className="text-red-500">*</span>}
                  </Label>
                  {question.description && (
                    <p className="text-xs text-muted-foreground">{question.description}</p>
                  )}
                  
                  {/* Render input based on type */}
                  {question.type === "text" && (
                    <Input placeholder={question.placeholder} disabled />
                  )}
                  {question.type === "textarea" && (
                    <Textarea placeholder={question.placeholder} rows={3} disabled />
                  )}
                  {question.type === "email" && (
                    <Input type="email" placeholder={question.placeholder || "email@example.com"} disabled />
                  )}
                  {question.type === "phone" && (
                    <Input type="tel" placeholder={question.placeholder || "+27 12 345 6789"} disabled />
                  )}
                  {question.type === "number" && (
                    <Input type="number" placeholder={question.placeholder || "0"} disabled className="w-32" />
                  )}
                  {question.type === "date" && (
                    <Input type="date" disabled className="w-48" />
                  )}
                  {question.type === "time" && (
                    <Input type="time" disabled className="w-32" />
                  )}
                  {question.type === "radio" && (
                    <div className="space-y-2">
                      {question.options.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2">
                          <input type="radio" name={question.id} disabled />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {question.type === "checkbox" && (
                    <div className="space-y-2">
                      {question.options.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2">
                          <input type="checkbox" disabled />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {question.type === "dropdown" && (
                    <Select disabled>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {question.options.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuestionnairesManage;
