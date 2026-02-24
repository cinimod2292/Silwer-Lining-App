import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle, Calendar, Clock, Package, User, Phone, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CompleteBookingPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [completed, setCompleted] = useState(false);
  
  const [bookingData, setBookingData] = useState(null);
  const [packages, setPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [questionnaire, setQuestionnaire] = useState(null);
  
  const [formData, setFormData] = useState({
    package_id: "",
    package_name: "",
    package_price: 0,
    selected_addons: [],
    addons_total: 0,
    client_phone: "",
    notes: "",
    questionnaire_responses: {}
  });

  const fetchBookingData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/booking-token/${token}`);
      setBookingData(res.data.booking);
      setPackages(res.data.packages || []);
      setAddons(res.data.addons || []);
      setQuestionnaire(res.data.questionnaire);
      
      // Initialize questionnaire responses
      if (res.data.questionnaire?.questions) {
        const initial = {};
        res.data.questionnaire.questions.forEach(q => {
          if (q.type === "checkbox") {
            initial[q.id] = [];
          } else {
            initial[q.id] = "";
          }
        });
        setFormData(prev => ({ ...prev, questionnaire_responses: initial }));
      }
      
      // Pre-fill phone if available
      if (res.data.booking?.client_phone) {
        setFormData(prev => ({ ...prev, client_phone: res.data.booking.client_phone }));
      }
    } catch (e) {
      setError(e.response?.data?.detail || "This booking link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBookingData();
  }, [fetchBookingData]);

  const handlePackageSelect = (pkg) => {
    setFormData(prev => ({
      ...prev,
      package_id: pkg.id,
      package_name: pkg.name,
      package_price: pkg.price
    }));
  };

  const toggleAddon = (addonId, addonPrice) => {
    setFormData(prev => {
      const current = prev.selected_addons;
      let newAddons, newTotal;
      
      if (current.includes(addonId)) {
        newAddons = current.filter(id => id !== addonId);
        newTotal = prev.addons_total - addonPrice;
      } else {
        newAddons = [...current, addonId];
        newTotal = prev.addons_total + addonPrice;
      }
      
      return { ...prev, selected_addons: newAddons, addons_total: newTotal };
    });
  };

  const handleQuestionnaireChange = (questionId, value, isCheckbox = false) => {
    setFormData(prev => {
      const responses = { ...prev.questionnaire_responses };
      if (isCheckbox) {
        const current = responses[questionId] || [];
        if (current.includes(value)) {
          responses[questionId] = current.filter(v => v !== value);
        } else {
          responses[questionId] = [...current, value];
        }
      } else {
        responses[questionId] = value;
      }
      return { ...prev, questionnaire_responses: responses };
    });
  };

  const calculateTotal = () => {
    return formData.package_price + formData.addons_total;
  };

  const handleSubmit = async () => {
    if (!formData.package_id) {
      toast.error("Please select a package");
      return;
    }
    
    setSubmitting(true);
    try {
      await axios.post(`${API}/booking-token/${token}/complete`, {
        ...formData,
        total_price: calculateTotal()
      });
      setCompleted(true);
      toast.success("Booking completed successfully!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to complete booking");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-soft p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-display font-semibold mb-2">Booking Link Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate("/booking")}></Button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-soft p-8 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-semibold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for completing your booking. You will receive a confirmation email shortly.
          </p>
          <div className="bg-warm-sand rounded-lg p-4 mb-6 text-left">
            <p><strong>Session:</strong> {bookingData.session_type}</p>
            <p><strong>Date:</strong> {bookingData.booking_date}</p>
            <p><strong>Time:</strong> {bookingData.booking_time}</p>
            <p><strong>Total:</strong> R{calculateTotal().toLocaleString()}</p>
          </div>
          <Button onClick={() => navigate("/")}>Return to Homepage</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-cream py-12 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-2">Complete Your Booking</h1>
          <p className="text-muted-foreground">Hi {bookingData.client_name}! Please select your package and complete the booking details.</p>
        </div>

        {/* Booking Summary */}
        <div className="bg-white rounded-xl shadow-soft p-6 mb-8">
          <h2 className="font-semibold mb-4">Your Session</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <span>{bookingData.booking_date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span>{bookingData.booking_time}</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <span className="capitalize">{bookingData.session_type}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <span className="truncate">{bookingData.client_email}</span>
            </div>
          </div>
        </div>

        {/* Package Selection */}
        <div className="bg-white rounded-xl shadow-soft p-6 mb-8">
          <h2 className="font-semibold mb-4">Select Your Package *</h2>
          <div className="grid gap-4">
            {packages.length > 0 ? packages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => handlePackageSelect(pkg)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.package_id === pkg.id
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-primary/50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{pkg.name}</h3>
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                    {pkg.includes && (
                      <ul className="mt-2 text-sm text-muted-foreground">
                        {pkg.includes.map((item, i) => (
                          <li key={i}>• {item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="text-xl font-semibold text-primary">R{pkg.price?.toLocaleString()}</span>
                </div>
              </div>
            )) : (
              <p className="text-muted-foreground">No packages available for this session type.</p>
            )}
          </div>
        </div>

        {/* Add-ons */}
        {addons.length > 0 && (
          <div className="bg-white rounded-xl shadow-soft p-6 mb-8">
            <h2 className="font-semibold mb-4">Optional Add-ons</h2>
            <div className="grid gap-3">
              {addons.map((addon) => (
                <div
                  key={addon.id}
                  onClick={() => toggleAddon(addon.id, addon.price)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    formData.selected_addons.includes(addon.id)
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-primary/50"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={formData.selected_addons.includes(addon.id)}
                        onChange={() => {}}
                      />
                      <div>
                        <h3 className="font-medium">{addon.name}</h3>
                        {addon.description && (
                          <p className="text-sm text-muted-foreground">{addon.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-primary">+R{addon.price?.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Questionnaire */}
        {questionnaire?.questions?.length > 0 && (
          <div className="bg-white rounded-xl shadow-soft p-6 mb-8">
            <h2 className="font-semibold mb-2">{questionnaire.title || "Session Questionnaire"}</h2>
            {questionnaire.description && (
              <p className="text-sm text-muted-foreground mb-4">{questionnaire.description}</p>
            )}
            
            <div className="space-y-6">
              {questionnaire.questions.map((question) => (
                <div key={question.id} className="space-y-2">
                  <Label className="flex items-center gap-1">
                    {question.label}
                    {question.required && <span className="text-red-500">*</span>}
                  </Label>
                  {question.description && (
                    <p className="text-xs text-muted-foreground">{question.description}</p>
                  )}
                  
                  {question.type === "text" && (
                    <Input
                      value={formData.questionnaire_responses[question.id] || ""}
                      onChange={(e) => handleQuestionnaireChange(question.id, e.target.value)}
                      placeholder={question.placeholder}
                    />
                  )}
                  
                  {question.type === "textarea" && (
                    <Textarea
                      value={formData.questionnaire_responses[question.id] || ""}
                      onChange={(e) => handleQuestionnaireChange(question.id, e.target.value)}
                      placeholder={question.placeholder}
                      rows={3}
                    />
                  )}
                  
                  {question.type === "radio" && (
                    <RadioGroup
                      value={formData.questionnaire_responses[question.id] || ""}
                      onValueChange={(value) => handleQuestionnaireChange(question.id, value)}
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
                  
                  {question.type === "checkbox" && (
                    <div className="space-y-2">
                      {question.options?.map((opt) => (
                        <div key={opt.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={opt.id}
                            checked={(formData.questionnaire_responses[question.id] || []).includes(opt.label)}
                            onCheckedChange={() => handleQuestionnaireChange(question.id, opt.label, true)}
                          />
                          <Label htmlFor={opt.id} className="font-normal cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === "dropdown" && (
                    <Select
                      value={formData.questionnaire_responses[question.id] || ""}
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
          </div>
        )}

        {/* Additional Details */}
        <div className="bg-white rounded-xl shadow-soft p-6 mb-8">
          <h2 className="font-semibold mb-4">Additional Information</h2>
          <div className="space-y-4">
            <div>
              <Label>Phone Number</Label>
              <Input
                type="tel"
                value={formData.client_phone}
                onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                placeholder="+27 12 345 6789"
              />
            </div>
            <div>
              <Label>Notes or Special Requests</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Any additional information you'd like us to know..."
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Total & Submit */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex justify-between items-center mb-6">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-bold text-primary">R{calculateTotal().toLocaleString()}</span>
          </div>
          
          {formData.package_price > 0 && (
            <div className="text-sm text-muted-foreground mb-4 space-y-1">
              <div className="flex justify-between">
                <span>Package: {formData.package_name}</span>
                <span>R{formData.package_price.toLocaleString()}</span>
              </div>
              {formData.addons_total > 0 && (
                <div className="flex justify-between">
                  <span>Add-ons</span>
                  <span>R{formData.addons_total.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
          
          <Button
            onClick={handleSubmit}
            disabled={submitting || !formData.package_id}
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-6 text-lg"
          >
            {submitting ? "Confirming..." : "Confirm Booking"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CompleteBookingPage;