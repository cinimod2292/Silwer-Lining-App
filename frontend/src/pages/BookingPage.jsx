import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, Clock, User, Mail, Phone, FileText, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { format, addDays, isBefore, startOfDay } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const sessionTypes = [
  { id: "maternity", name: "Maternity" },
  { id: "newborn", name: "Newborn" },
  { id: "family", name: "Family" },
  { id: "individual", name: "Individual" },
];

const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [packages, setPackages] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);

  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    session_type: searchParams.get("type") || "",
    package_name: searchParams.get("package") || "",
    booking_date: null,
    booking_time: "",
    notes: "",
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  useEffect(() => {
    if (formData.booking_date) {
      fetchAvailableTimes(format(formData.booking_date, "yyyy-MM-dd"));
    }
  }, [formData.booking_date]);

  const fetchPackages = async () => {
    try {
      const res = await axios.get(`${API}/packages`);
      setPackages(res.data);
    } catch (e) {
      console.error("Failed to fetch packages");
    }
  };

  const fetchAvailableTimes = async (date) => {
    try {
      const res = await axios.get(`${API}/bookings/available-times?date=${date}`);
      setAvailableTimes(res.data.available_times);
    } catch (e) {
      console.error("Failed to fetch times");
      setAvailableTimes([
        "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
        "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
      ]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getFilteredPackages = () => {
    if (!formData.session_type) return [];
    return packages.filter((pkg) => pkg.session_type === formData.session_type);
  };

  const isDateDisabled = (date) => {
    return isBefore(date, startOfDay(new Date()));
  };

  const validateStep = (currentStep) => {
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
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        booking_date: format(formData.booking_date, "yyyy-MM-dd"),
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
          {[
            { num: 1, label: "Session" },
            { num: 2, label: "Date & Time" },
            { num: 3, label: "Details" },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  step >= s.num
                    ? "bg-primary text-white"
                    : "bg-warm-sand text-muted-foreground"
                }`}
              >
                {s.num}
              </div>
              <span className="ml-2 text-sm hidden md:block">{s.label}</span>
              {i < 2 && (
                <div
                  className={`w-12 md:w-24 h-0.5 ml-4 ${
                    step > s.num ? "bg-primary" : "bg-warm-sand"
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
            {/* Step 1: Session Type & Package */}
            {step === 1 && (
              <div className="space-y-8" data-testid="step-1">
                <div>
                  <Label className="text-base font-semibold mb-4 block">
                    What type of session are you looking for?
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                              {pkg.duration} • {pkg.includes.slice(0, 2).join(", ")}...
                            </span>
                          </div>
                          <span className="font-display text-xl font-semibold text-primary">
                            ${pkg.price}
                          </span>
                        </button>
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
                  <div className="flex justify-center">
                    <CalendarComponent
                      mode="single"
                      selected={formData.booking_date}
                      onSelect={(date) => handleInputChange("booking_date", date)}
                      disabled={isDateDisabled}
                      fromDate={new Date()}
                      className="rounded-xl border shadow-soft"
                      data-testid="booking-calendar"
                    />
                  </div>
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

            {/* Step 3: Contact Details */}
            {step === 3 && (
              <div className="space-y-6" data-testid="step-3">
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
                    placeholder="(555) 123-4567"
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

                {/* Summary */}
                <div className="bg-warm-sand rounded-xl p-6 mt-8">
                  <h3 className="font-semibold mb-4">Booking Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Session Type:</span>
                      <span className="capitalize">{formData.session_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Package:</span>
                      <span>{formData.package_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span>{formData.booking_date && format(formData.booking_date, "MMMM d, yyyy")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time:</span>
                      <span>{formData.booking_time}</span>
                    </div>
                  </div>
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
              {step < 3 ? (
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
