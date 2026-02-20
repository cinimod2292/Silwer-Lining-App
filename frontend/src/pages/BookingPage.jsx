import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, Clock, User, Mail, Phone, FileText, CheckCircle, Plus, X, AlertTriangle, ClipboardList, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { toast } from "sonner";
import axios from "axios";
import { format, isBefore, startOfDay, isWeekend } from "date-fns";
import ContractStep from "@/components/ContractStep";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const sessionTypes = [
  { id: "maternity", name: "Maternity" },
  { id: "newborn", name: "Newborn" },
  { id: "studio", name: "Studio Portraits" },
];

// Available add-ons with prices in ZAR
const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [packages, setPackages] = useState([]);
  const [availableAddOns, setAvailableAddOns] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingSettings, setBookingSettings] = useState(null);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [questionnaireResponses, setQuestionnaireResponses] = useState({});
  const [contract, setContract] = useState(null);
  const [contractData, setContractData] = useState(null);
  
  // Weekend popup state
  const [showWeekendPopup, setShowWeekendPopup] = useState(false);
  const [pendingWeekendDate, setPendingWeekendDate] = useState(null);

  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    session_type: searchParams.get("type") || "",
    package_name: searchParams.get("package") || "",
    booking_date: null,
    booking_time: "",
    notes: "",
    selected_addons: [],
    is_weekend: false,
  });

  useEffect(() => {
    fetchPackages();
    fetchBookingSettings();
    fetchAddOns();
    fetchContract();
  }, []);

  // Fetch available times when date OR session type changes
  useEffect(() => {
    if (formData.booking_date && formData.session_type) {
      fetchAvailableTimes(format(formData.booking_date, "yyyy-MM-dd"), formData.session_type);
    } else if (formData.booking_date) {
      fetchAvailableTimes(format(formData.booking_date, "yyyy-MM-dd"));
    }
  }, [formData.booking_date, formData.session_type]);

  // Re-fetch add-ons when session type changes
  useEffect(() => {
    if (formData.session_type) {
      fetchAddOns(formData.session_type);
      fetchQuestionnaire(formData.session_type);
    }
  }, [formData.session_type]);

  const fetchPackages = async () => {
    try {
      const res = await axios.get(`${API}/packages`);
      setPackages(res.data);
    } catch (e) {
      console.error("Failed to fetch packages");
    }
  };

  const fetchAddOns = async (sessionType = null) => {
    try {
      let url = `${API}/addons`;
      if (sessionType) {
        url += `?session_type=${sessionType}`;
      }
      const res = await axios.get(url);
      setAvailableAddOns(res.data);
    } catch (e) {
      console.error("Failed to fetch add-ons");
      // Fallback add-ons if API fails
      setAvailableAddOns([
        { id: "makeup", name: "Makeup Artist", price: 800, description: "Professional makeup for your session" },
        { id: "extra_images", name: "10 Additional Edited Images", price: 1500, description: "Expand your gallery with more edited photos" },
      ]);
    }
  };

  const fetchBookingSettings = async () => {
    try {
      const res = await axios.get(`${API}/booking-settings`);
      setBookingSettings(res.data);
    } catch (e) {
      console.error("Failed to fetch booking settings");
      setBookingSettings({ weekend_surcharge: 750 });
    }
  };

  const fetchContract = async () => {
    try {
      const res = await axios.get(`${API}/contract`);
      if (res.data && res.data.content) {
        setContract(res.data);
      }
    } catch (e) {
      console.error("No contract configured");
      setContract(null);
    }
  };

  const fetchQuestionnaire = async (sessionType) => {
    try {
      const res = await axios.get(`${API}/questionnaire/${sessionType}`);
      if (res.data && res.data.questions && res.data.questions.length > 0) {
        setQuestionnaire(res.data);
        // Initialize responses object
        const initialResponses = {};
        res.data.questions.forEach(q => {
          if (q.type === "checkbox") {
            initialResponses[q.id] = [];
          } else {
            initialResponses[q.id] = "";
          }
        });
        setQuestionnaireResponses(initialResponses);
      } else {
        setQuestionnaire(null);
        setQuestionnaireResponses({});
      }
    } catch (e) {
      console.error("No questionnaire for this session type");
      setQuestionnaire(null);
      setQuestionnaireResponses({});
    }
  };

  const fetchAvailableTimes = async (date, sessionType = null) => {
    try {
      let url = `${API}/bookings/available-times?date=${date}`;
      if (sessionType) {
        url += `&session_type=${sessionType}`;
      }
      const res = await axios.get(url);
      setAvailableTimes(res.data.available_times || []);
    } catch (e) {
      console.error("Failed to fetch times");
      setAvailableTimes([]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateSelect = (date) => {
    if (!date) return;
    
    const weekend = isWeekend(date);
    
    if (weekend) {
      setPendingWeekendDate(date);
      setShowWeekendPopup(true);
    } else {
      setFormData((prev) => ({ 
        ...prev, 
        booking_date: date,
        booking_time: "",
        is_weekend: false 
      }));
    }
  };

  const confirmWeekendDate = () => {
    setFormData((prev) => ({ 
      ...prev, 
      booking_date: pendingWeekendDate,
      booking_time: "",
      is_weekend: true 
    }));
    setShowWeekendPopup(false);
    setPendingWeekendDate(null);
  };

  const cancelWeekendDate = () => {
    setShowWeekendPopup(false);
    setPendingWeekendDate(null);
  };

  const toggleAddon = (addonId) => {
    setFormData((prev) => {
      const current = prev.selected_addons;
      if (current.includes(addonId)) {
        return { ...prev, selected_addons: current.filter(id => id !== addonId) };
      } else {
        return { ...prev, selected_addons: [...current, addonId] };
      }
    });
  };

  const handleQuestionnaireChange = (questionId, value, isCheckbox = false) => {
    setQuestionnaireResponses((prev) => {
      if (isCheckbox) {
        const current = prev[questionId] || [];
        if (current.includes(value)) {
          return { ...prev, [questionId]: current.filter(v => v !== value) };
        } else {
          return { ...prev, [questionId]: [...current, value] };
        }
      }
      return { ...prev, [questionId]: value };
    });
  };

  const getTotalSteps = () => {
    // Base steps: 1. Session & Add-ons, 2. Date & Time, 3. Contract, 4. Details
    // If questionnaire exists, add it before contract
    let steps = 4; // base without questionnaire
    if (questionnaire?.questions?.length > 0) {
      steps = 5; // with questionnaire
    }
    return steps;
  };

  const getStepLabel = (stepNum) => {
    const hasQuestionnaire = questionnaire?.questions?.length > 0;
    
    if (hasQuestionnaire) {
      // 5 steps: Session, Date, Questionnaire, Contract, Details
      switch (stepNum) {
        case 1: return "Session & Add-ons";
        case 2: return "Date & Time";
        case 3: return "Questionnaire";
        case 4: return "Contract";
        case 5: return "Your Details";
        default: return "";
      }
    } else {
      // 4 steps: Session, Date, Contract, Details
      switch (stepNum) {
        case 1: return "Session & Add-ons";
        case 2: return "Date & Time";
        case 3: return "Contract";
        case 4: return "Your Details";
        default: return "";
      }
    }
  };

  const getContractStep = () => {
    return questionnaire?.questions?.length > 0 ? 4 : 3;
  };

  const getDetailsStep = () => {
    return questionnaire?.questions?.length > 0 ? 5 : 4;
  };

  const getFilteredPackages = () => {
    if (!formData.session_type) return [];
    return packages.filter((pkg) => pkg.session_type === formData.session_type);
  };

  const getSelectedPackage = () => {
    return packages.find((pkg) => pkg.name === formData.package_name);
  };

  const getSelectedAddons = () => {
    return availableAddOns.filter((addon) => formData.selected_addons.includes(addon.id));
  };

  const getWeekendSurcharge = () => {
    return bookingSettings?.weekend_surcharge || 500;
  };

  const calculateTotal = () => {
    const pkg = getSelectedPackage();
    const basePrice = pkg?.price || 0;
    const addonsTotal = getSelectedAddons().reduce((sum, addon) => sum + addon.price, 0);
    const weekendCharge = formData.is_weekend ? getWeekendSurcharge() : 0;
    return basePrice + addonsTotal + weekendCharge;
  };

  const isDateDisabled = (date) => {
    return isBefore(date, startOfDay(new Date()));
  };

  const validateStep = (currentStep) => {
    const totalSteps = getTotalSteps();
    
    if (totalSteps === 4) {
      switch (currentStep) {
        case 1:
          return formData.session_type && formData.package_name;
        case 2:
          return formData.booking_date && formData.booking_time;
        case 3:
          // Validate required questionnaire fields
          if (!questionnaire?.questions) return true;
          const requiredQuestions = questionnaire.questions.filter(q => q.required);
          return requiredQuestions.every(q => {
            const response = questionnaireResponses[q.id];
            if (q.type === "checkbox") {
              return response && response.length > 0;
            }
            return response && response.toString().trim() !== "";
          });
        case 4:
          return formData.client_name && formData.client_email && formData.client_phone;
        default:
          return false;
      }
    } else {
      switch (currentStep) {
        case 1:
          return formData.session_type && formData.package_name;
        case 2:
          return formData.booking_date && formData.booking_time;
        case 3:
          return formData.client_name && formData.client_email && formData.client_phone;
        default:
          return false;
      }
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const selectedPkg = getSelectedPackage();
      const selectedAddons = getSelectedAddons();
      const addonsTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
      
      const payload = {
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
        session_type: formData.session_type,
        package_id: selectedPkg?.id || "",
        package_name: formData.package_name,
        package_price: selectedPkg?.price || 0,
        booking_date: format(formData.booking_date, "yyyy-MM-dd"),
        booking_time: formData.booking_time,
        notes: formData.notes,
        selected_addons: formData.selected_addons,
        addons_total: addonsTotal,
        is_weekend: formData.is_weekend,
        weekend_surcharge: formData.is_weekend ? getWeekendSurcharge() : 0,
        total_price: calculateTotal(),
        questionnaire_responses: questionnaire ? questionnaireResponses : {},
      };
      await axios.post(`${API}/bookings`, payload);
      setBookingComplete(true);
      toast.success("Booking confirmed! Check your email for confirmation.");
    } catch (e) {
      toast.error("Failed to complete booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (bookingComplete) {
    const selectedPackage = getSelectedPackage();
    const selectedAddons = getSelectedAddons();
    
    return (
      <div className="min-h-screen flex items-center justify-center px-6" data-testid="booking-success">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-semibold mb-4">Booking Confirmed!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for booking with Silwer Lining Photography! We've sent a confirmation
            email to <strong>{formData.client_email}</strong> with all the details.
          </p>
          <div className="bg-warm-sand rounded-xl p-6 text-left mb-8">
            <h3 className="font-semibold mb-4">Booking Details:</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Session:</strong> {formData.session_type}</p>
              <p><strong>Package:</strong> {formData.package_name}</p>
              <p><strong>Date:</strong> {format(formData.booking_date, "MMMM d, yyyy")}</p>
              <p><strong>Time:</strong> {formData.booking_time}</p>
              {selectedAddons.length > 0 && (
                <p><strong>Add-ons:</strong> {selectedAddons.map(a => a.name).join(", ")}</p>
              )}
              <div className="border-t border-border pt-3 mt-3">
                <p className="font-semibold text-lg">Total: R{calculateTotal().toLocaleString()}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            We'll be in touch soon to discuss the details of your session!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Weekend Surcharge Popup */}
      <Dialog open={showWeekendPopup} onOpenChange={setShowWeekendPopup}>
        <DialogContent className="sm:max-w-md" data-testid="weekend-popup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Weekend Session Fee
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground mb-4">
              You've selected a <strong>weekend date</strong>. Weekend and public holiday sessions 
              include an additional fee.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-700 mb-1">Weekend Surcharge</p>
              <p className="text-2xl font-display font-semibold text-amber-800">
                R{getWeekendSurcharge().toLocaleString()}
              </p>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              This fee will be added to your total booking price.
            </p>
          </div>
          <DialogFooter className="flex gap-3 sm:gap-3">
            <Button 
              variant="outline" 
              onClick={cancelWeekendDate}
              className="flex-1"
              data-testid="weekend-cancel"
            >
              Select Different Date
            </Button>
            <Button 
              onClick={confirmWeekendDate}
              className="flex-1 bg-primary hover:bg-primary/90 text-white"
              data-testid="weekend-confirm"
            >
              Continue with Weekend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <section className="bg-warm-sand py-20 md:py-28" data-testid="booking-header">
        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
          <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
            Book Your Session
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6">
            Let's Create Something Beautiful
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Choose your session type, pick a date that works for you, and we'll take care
            of the rest. Your memories are just a few clicks away.
          </p>
        </div>
      </section>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-8">
        <div className="flex items-center justify-center gap-4 md:gap-8">
          {Array.from({ length: getTotalSteps() }, (_, i) => i + 1).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  step >= s
                    ? "bg-primary text-white"
                    : "bg-warm-sand text-muted-foreground"
                }`}
              >
                {s}
              </div>
              <span className="ml-2 text-sm hidden md:block">{getStepLabel(s)}</span>
              {i < getTotalSteps() - 1 && (
                <div
                  className={`w-12 md:w-24 h-0.5 ml-4 ${
                    step > s ? "bg-primary" : "bg-warm-sand"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <section className="pb-20 md:pb-28" data-testid="booking-form">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <div className="bg-white rounded-2xl shadow-soft p-8 md:p-12">
            {/* Step 1: Session Type, Package & Add-ons */}
            {step === 1 && (
              <div className="space-y-8" data-testid="step-1">
                <div>
                  <Label className="text-base font-semibold mb-4 block">
                    What type of session are you looking for?
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {sessionTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => {
                          handleInputChange("session_type", type.id);
                          handleInputChange("package_name", "");
                        }}
                        className={`p-4 rounded-xl border-2 transition-all text-center ${
                          formData.session_type === type.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        data-testid={`session-type-${type.id}`}
                      >
                        <span className="font-medium">{type.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {formData.session_type && (
                  <div>
                    <Label className="text-base font-semibold mb-4 block">
                      Choose your package
                    </Label>
                    <div className="grid gap-4">
                      {getFilteredPackages().map((pkg) => (
                        <button
                          key={pkg.id}
                          onClick={() => handleInputChange("package_name", pkg.name)}
                          className={`p-5 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                            formData.package_name === pkg.name
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          data-testid={`package-option-${pkg.id}`}
                        >
                          <div>
                            <span className="font-semibold block">{pkg.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {pkg.duration} • {pkg.includes?.slice(0, 2).join(", ")}...
                            </span>
                          </div>
                          <span className="font-display text-xl font-semibold text-primary">
                            R{pkg.price?.toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons Section */}
                {formData.package_name && (
                  <div>
                    <Label className="text-base font-semibold mb-2 block">
                      <Plus className="w-5 h-5 inline mr-2" />
                      Enhance your session with add-ons
                    </Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Optional extras to make your session even more special
                    </p>
                    <div className="grid gap-3">
                      {availableAddOns.map((addon) => (
                        <div
                          key={addon.id}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                            formData.selected_addons.includes(addon.id)
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          }`}
                          onClick={() => toggleAddon(addon.id)}
                          data-testid={`addon-${addon.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={formData.selected_addons.includes(addon.id)}
                                onCheckedChange={() => toggleAddon(addon.id)}
                                className="pointer-events-none"
                              />
                              <div>
                                <span className="font-medium block">{addon.name}</span>
                                <span className="text-sm text-muted-foreground">{addon.description}</span>
                              </div>
                            </div>
                            <span className="font-semibold text-primary whitespace-nowrap ml-4">
                              +R{addon.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Date & Time */}
            {step === 2 && (
              <div className="space-y-8" data-testid="step-2">
                <div>
                  <Label className="text-base font-semibold mb-4 block">
                    <Calendar className="w-5 h-5 inline mr-2" />
                    Select a date
                  </Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Note: Weekend sessions include an additional R{getWeekendSurcharge().toLocaleString()} fee
                  </p>
                  <div className="flex justify-center">
                    <CalendarComponent
                      mode="single"
                      selected={formData.booking_date}
                      onSelect={handleDateSelect}
                      disabled={isDateDisabled}
                      fromDate={new Date()}
                      className="rounded-xl border shadow-soft"
                      data-testid="booking-calendar"
                    />
                  </div>
                  {formData.is_weekend && formData.booking_date && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-sm text-amber-700">
                        Weekend surcharge of R{getWeekendSurcharge().toLocaleString()} will be added
                      </span>
                    </div>
                  )}
                </div>

                {formData.booking_date && (
                  <div>
                    <Label className="text-base font-semibold mb-4 block">
                      <Clock className="w-5 h-5 inline mr-2" />
                      Choose a time
                    </Label>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                      {availableTimes.map((time) => (
                        <button
                          key={time}
                          onClick={() => handleInputChange("booking_time", time)}
                          className={`py-3 px-4 rounded-lg border-2 text-sm transition-all ${
                            formData.booking_time === time
                              ? "border-primary bg-primary text-white"
                              : "border-border hover:border-primary/50"
                          }`}
                          data-testid={`time-slot-${time.replace(/\s/g, "-")}`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                    {availableTimes.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">
                        No available times for this date. Please select another date.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Questionnaire (only if questionnaire exists) */}
            {step === 3 && getTotalSteps() === 4 && questionnaire && (
              <div className="space-y-6" data-testid="step-3-questionnaire">
                <div className="text-center mb-8">
                  <ClipboardList className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h2 className="font-display text-xl font-semibold">
                    {questionnaire.title || `${formData.session_type?.replace('-', ' ')} Session Questionnaire`}
                  </h2>
                  {questionnaire.description && (
                    <p className="text-muted-foreground mt-2">{questionnaire.description}</p>
                  )}
                </div>
                
                {questionnaire.questions?.map((question) => (
                  <div key={question.id} className="space-y-2" data-testid={`question-${question.id}`}>
                    <Label className="flex items-center gap-1 text-base">
                      {question.label}
                      {question.required && <span className="text-red-500">*</span>}
                    </Label>
                    {question.description && (
                      <p className="text-xs text-muted-foreground">{question.description}</p>
                    )}
                    
                    {/* Text input */}
                    {question.type === "text" && (
                      <Input
                        value={questionnaireResponses[question.id] || ""}
                        onChange={(e) => handleQuestionnaireChange(question.id, e.target.value)}
                        placeholder={question.placeholder}
                        className="h-12"
                      />
                    )}
                    
                    {/* Textarea */}
                    {question.type === "textarea" && (
                      <Textarea
                        value={questionnaireResponses[question.id] || ""}
                        onChange={(e) => handleQuestionnaireChange(question.id, e.target.value)}
                        placeholder={question.placeholder}
                        rows={3}
                      />
                    )}
                    
                    {/* Email */}
                    {question.type === "email" && (
                      <Input
                        type="email"
                        value={questionnaireResponses[question.id] || ""}
                        onChange={(e) => handleQuestionnaireChange(question.id, e.target.value)}
                        placeholder={question.placeholder || "email@example.com"}
                        className="h-12"
                      />
                    )}
                    
                    {/* Phone */}
                    {question.type === "phone" && (
                      <Input
                        type="tel"
                        value={questionnaireResponses[question.id] || ""}
                        onChange={(e) => handleQuestionnaireChange(question.id, e.target.value)}
                        placeholder={question.placeholder || "+27 12 345 6789"}
                        className="h-12"
                      />
                    )}
                    
                    {/* Number */}
                    {question.type === "number" && (
                      <Input
                        type="number"
                        value={questionnaireResponses[question.id] || ""}
                        onChange={(e) => handleQuestionnaireChange(question.id, e.target.value)}
                        placeholder={question.placeholder || "0"}
                        className="h-12 w-32"
                      />
                    )}
                    
                    {/* Date */}
                    {question.type === "date" && (
                      <Input
                        type="date"
                        value={questionnaireResponses[question.id] || ""}
                        onChange={(e) => handleQuestionnaireChange(question.id, e.target.value)}
                        className="h-12 w-48"
                      />
                    )}
                    
                    {/* Time */}
                    {question.type === "time" && (
                      <Input
                        type="time"
                        value={questionnaireResponses[question.id] || ""}
                        onChange={(e) => handleQuestionnaireChange(question.id, e.target.value)}
                        className="h-12 w-32"
                      />
                    )}
                    
                    {/* Radio (Multiple Choice) */}
                    {question.type === "radio" && (
                      <RadioGroup
                        value={questionnaireResponses[question.id] || ""}
                        onValueChange={(value) => handleQuestionnaireChange(question.id, value)}
                        className="space-y-2"
                      >
                        {question.options?.map((opt) => (
                          <div key={opt.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={opt.label} id={opt.id} />
                            <Label htmlFor={opt.id} className="font-normal cursor-pointer">
                              {opt.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                    
                    {/* Checkbox (Multiple Select) */}
                    {question.type === "checkbox" && (
                      <div className="space-y-2">
                        {question.options?.map((opt) => (
                          <div key={opt.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={opt.id}
                              checked={(questionnaireResponses[question.id] || []).includes(opt.label)}
                              onCheckedChange={() => handleQuestionnaireChange(question.id, opt.label, true)}
                            />
                            <Label htmlFor={opt.id} className="font-normal cursor-pointer">
                              {opt.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Dropdown */}
                    {question.type === "dropdown" && (
                      <Select
                        value={questionnaireResponses[question.id] || ""}
                        onValueChange={(value) => handleQuestionnaireChange(question.id, value)}
                      >
                        <SelectTrigger className="w-full md:w-64">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {question.options?.map((opt) => (
                            <SelectItem key={opt.id} value={opt.label}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Step 3 (no questionnaire) or Step 4 (with questionnaire): Contact Details & Summary */}
            {((step === 3 && getTotalSteps() === 3) || (step === 4 && getTotalSteps() === 4)) && (
              <div className="space-y-6" data-testid="step-details">
                <div>
                  <Label htmlFor="name" className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4" /> Full Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Your full name"
                    value={formData.client_name}
                    onChange={(e) => handleInputChange("client_name", e.target.value)}
                    className="h-12"
                    data-testid="input-name"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4" /> Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.client_email}
                    onChange={(e) => handleInputChange("client_email", e.target.value)}
                    className="h-12"
                    data-testid="input-email"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4" /> Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+27 12 345 6789"
                    value={formData.client_phone}
                    onChange={(e) => handleInputChange("client_phone", e.target.value)}
                    className="h-12"
                    data-testid="input-phone"
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" /> Additional Notes (Optional)
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special requests or information we should know..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={4}
                    data-testid="input-notes"
                  />
                </div>

                {/* Price Breakdown Summary */}
                <div className="bg-warm-sand rounded-xl p-6 mt-8" data-testid="booking-summary">
                  <h3 className="font-semibold mb-4 text-lg">Booking Summary</h3>
                  
                  {/* Session Details */}
                  <div className="space-y-2 text-sm border-b border-border/50 pb-4 mb-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Session Type:</span>
                      <span className="capitalize">{formData.session_type?.replace("-", " ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span>
                        {formData.booking_date && format(formData.booking_date, "MMMM d, yyyy")}
                        {formData.is_weekend && <span className="text-amber-600 ml-1">(Weekend)</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time:</span>
                      <span>{formData.booking_time}</span>
                    </div>
                  </div>

                  {/* Price Breakdown */}
                  <div className="space-y-3">
                    {/* Base Package */}
                    <div className="flex justify-between">
                      <span>{formData.package_name} Package</span>
                      <span className="font-medium">R{getSelectedPackage()?.price?.toLocaleString() || 0}</span>
                    </div>

                    {/* Add-ons */}
                    {getSelectedAddons().length > 0 && (
                      <div className="space-y-2 border-t border-border/30 pt-3">
                        <p className="text-sm text-muted-foreground font-medium">Add-ons:</p>
                        {getSelectedAddons().map((addon) => (
                          <div key={addon.id} className="flex justify-between text-sm pl-2">
                            <span className="text-muted-foreground">{addon.name}</span>
                            <span>+R{addon.price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Weekend Surcharge */}
                    {formData.is_weekend && (
                      <div className="flex justify-between text-sm border-t border-border/30 pt-3">
                        <span className="text-amber-700">Weekend Surcharge</span>
                        <span className="text-amber-700">+R{getWeekendSurcharge().toLocaleString()}</span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between border-t-2 border-foreground/20 pt-4 mt-4">
                      <span className="font-semibold text-lg">Total</span>
                      <span className="font-display text-2xl font-semibold text-primary">
                        R{calculateTotal().toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-4">
                    * A 50% deposit (R{(calculateTotal() / 2).toLocaleString()}) is required to secure your booking
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-10">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="rounded-full px-8"
                  data-testid="btn-back"
                >
                  Back
                </Button>
              )}
              {step < getTotalSteps() ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!validateStep(step)}
                  className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 ml-auto"
                  data-testid="btn-next"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!validateStep(step) || loading}
                  className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 ml-auto"
                  data-testid="btn-submit"
                >
                  {loading ? "Booking..." : "Confirm Booking"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BookingPage;
