import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Calendar, Clock, CheckCircle, XCircle, FileText, Mail, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ManageBookingPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [responses, setResponses] = useState({});
  const [view, setView] = useState("overview"); // overview, questionnaire, reschedule, cancel
  const [saving, setSaving] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    fetchBooking();
  }, [token]);

  const fetchBooking = async () => {
    try {
      const res = await axios.get(`${API}/client/booking/${token}`);
      setBooking(res.data.booking);
      setQuestionnaire(res.data.questionnaire);
      setResponses(res.data.booking.questionnaire_responses || {});
    } catch (e) {
      toast.error("Invalid or expired booking link");
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (questionId, value) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const saveQuestionnaire = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/client/booking/${token}/questionnaire`, { responses });
      toast.success("Questionnaire saved successfully!");
      setView("overview");
      fetchBooking();
    } catch (e) {
      toast.error("Failed to save questionnaire");
    } finally {
      setSaving(false);
    }
  };

  const emailQuestionnaire = async () => {
    setEmailSending(true);
    try {
      await axios.post(`${API}/client/booking/${token}/email-questionnaire`);
      toast.success("Questionnaire link sent to your email!");
    } catch (e) {
      toast.error("Failed to send email");
    } finally {
      setEmailSending(false);
    }
  };

  const requestReschedule = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/client/booking/${token}/request-reschedule`);
      toast.success("Reschedule request sent! We'll contact you shortly.");
      setView("overview");
    } catch (e) {
      toast.error("Failed to send request");
    } finally {
      setSaving(false);
    }
  };

  const requestCancellation = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/client/booking/${token}/request-cancel`);
      toast.success("Cancellation request sent! We'll contact you to confirm.");
      setView("overview");
    } catch (e) {
      toast.error("Failed to send request");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-ZA", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-soft p-8 text-center max-w-md">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-display font-semibold mb-2">Booking Not Found</h1>
          <p className="text-muted-foreground">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const questionnaireComplete = questionnaire?.questions?.length > 0 && 
    questionnaire.questions.every(q => responses[q.id]);

  return (
    <div className="min-h-screen bg-warm-cream py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-semibold mb-2">Manage Your Booking</h1>
          <p className="text-muted-foreground">
            {booking.client_name} • {booking.session_type?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Session
          </p>
        </div>

        {view === "overview" && (
          <div className="space-y-6">
            {/* Booking Details Card */}
            <div className="bg-white rounded-2xl shadow-soft p-6">
              <h2 className="font-semibold text-lg mb-4">Session Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(booking.booking_date)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {booking.booking_time}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Package</p>
                  <p className="font-medium">{booking.package_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className={`font-medium ${booking.status === 'confirmed' ? 'text-green-600' : 'text-amber-600'}`}>
                    {booking.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
              </div>
            </div>

            {/* Questionnaire Card */}
            {questionnaire && questionnaire.questions?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-soft p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-lg">Session Questionnaire</h2>
                  </div>
                  {questionnaireComplete ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="w-4 h-4" /> Completed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-amber-600">
                      <AlertTriangle className="w-4 h-4" /> Pending
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Help us prepare for your session by answering a few questions.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => setView("questionnaire")} className="flex-1">
                    {questionnaireComplete ? "Review Answers" : "Complete Questionnaire"}
                  </Button>
                  <Button variant="outline" onClick={emailQuestionnaire} disabled={emailSending}>
                    <Mail className="w-4 h-4 mr-2" />
                    {emailSending ? "Sending..." : "Email Me Link"}
                  </Button>
                </div>
              </div>
            )}

            {/* Actions Card */}
            <div className="bg-white rounded-2xl shadow-soft p-6">
              <h2 className="font-semibold text-lg mb-4">Need to Make Changes?</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={() => setView("reschedule")} className="flex-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  Request Reschedule
                </Button>
                <Button variant="outline" onClick={() => setView("cancel")} className="flex-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300">
                  <XCircle className="w-4 h-4 mr-2" />
                  Request Cancellation
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Reschedule requests are subject to availability. Cancellations may be subject to our cancellation policy.
              </p>
            </div>
          </div>
        )}

        {view === "questionnaire" && questionnaire && (
          <div className="bg-white rounded-2xl shadow-soft p-6 md:p-8">
            <div className="mb-8">
              <h2 className="font-display text-xl font-semibold mb-2">{questionnaire.title || "Session Questionnaire"}</h2>
              {questionnaire.description && (
                <p className="text-muted-foreground text-sm">{questionnaire.description}</p>
              )}
            </div>
            <div className="space-y-8">
              {questionnaire.questions?.map((q, idx) => (
                <div key={q.id} className="space-y-3">
                  <Label className="text-base font-medium text-foreground block">
                    {idx + 1}. {q.label || q.question} {q.required && <span className="text-red-500">*</span>}
                  </Label>
                  {q.description && (
                    <p className="text-sm text-muted-foreground -mt-1">{q.description}</p>
                  )}
                  
                  {q.type === "text" && (
                    <Input
                      value={responses[q.id] || ""}
                      onChange={(e) => handleResponseChange(q.id, e.target.value)}
                      placeholder={q.placeholder || "Your answer..."}
                      className="max-w-md"
                    />
                  )}
                  
                  {q.type === "textarea" && (
                    <Textarea
                      value={responses[q.id] || ""}
                      onChange={(e) => handleResponseChange(q.id, e.target.value)}
                      placeholder={q.placeholder || "Your answer..."}
                      rows={4}
                      className="max-w-lg"
                    />
                  )}

                  {q.type === "email" && (
                    <Input
                      type="email"
                      value={responses[q.id] || ""}
                      onChange={(e) => handleResponseChange(q.id, e.target.value)}
                      placeholder={q.placeholder || "email@example.com"}
                      className="max-w-md"
                    />
                  )}

                  {q.type === "phone" && (
                    <Input
                      type="tel"
                      value={responses[q.id] || ""}
                      onChange={(e) => handleResponseChange(q.id, e.target.value)}
                      placeholder={q.placeholder || "+27 12 345 6789"}
                      className="max-w-md"
                    />
                  )}

                  {q.type === "number" && (
                    <Input
                      type="number"
                      value={responses[q.id] || ""}
                      onChange={(e) => handleResponseChange(q.id, e.target.value)}
                      placeholder={q.placeholder || "0"}
                      className="w-32"
                    />
                  )}

                  {q.type === "date" && (
                    <Input
                      type="date"
                      value={responses[q.id] || ""}
                      onChange={(e) => handleResponseChange(q.id, e.target.value)}
                      className="w-48"
                    />
                  )}

                  {(q.type === "select" || q.type === "radio") && q.options && (
                    <RadioGroup
                      value={responses[q.id] || ""}
                      onValueChange={(val) => handleResponseChange(q.id, val)}
                      className="space-y-2"
                    >
                      {q.options.map((opt, i) => {
                        const optValue = typeof opt === 'string' ? opt : opt.label;
                        const optId = typeof opt === 'string' ? `${q.id}-${i}` : opt.id;
                        return (
                          <div key={optId} className="flex items-center space-x-3">
                            <RadioGroupItem value={optValue} id={optId} />
                            <Label htmlFor={optId} className="font-normal cursor-pointer">{optValue}</Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  )}

                  {q.type === "dropdown" && q.options && (
                    <select
                      value={responses[q.id] || ""}
                      onChange={(e) => handleResponseChange(q.id, e.target.value)}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select an option</option>
                      {q.options.map((opt, i) => {
                        const optValue = typeof opt === 'string' ? opt : opt.label;
                        return <option key={i} value={optValue}>{optValue}</option>;
                      })}
                    </select>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex gap-3 mt-10 pt-6 border-t">
              <Button variant="outline" onClick={() => setView("overview")}>Back</Button>
              <Button onClick={saveQuestionnaire} disabled={saving} className="flex-1 max-w-xs">
                {saving ? "Saving..." : "Save Questionnaire"}
              </Button>
            </div>
          </div>
        )}

        {view === "reschedule" && (
          <div className="bg-white rounded-2xl shadow-soft p-6">
            <h2 className="font-semibold text-lg mb-4">Request Reschedule</h2>
            <p className="text-muted-foreground mb-6">
              We'll contact you within 24 hours to arrange a new date and time for your session.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setView("overview")}>Cancel</Button>
              <Button onClick={requestReschedule} disabled={saving} className="flex-1">
                {saving ? "Sending..." : "Send Reschedule Request"}
              </Button>
            </div>
          </div>
        )}

        {view === "cancel" && (
          <div className="bg-white rounded-2xl shadow-soft p-6">
            <h2 className="font-semibold text-lg mb-4 text-red-600">Request Cancellation</h2>
            <p className="text-muted-foreground mb-4">
              We're sorry to see you go. Please note our cancellation policy may apply.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-800">
              <strong>Cancellation Policy:</strong> Cancellations made less than 48 hours before the session may forfeit the deposit.
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setView("overview")}>Go Back</Button>
              <Button variant="destructive" onClick={requestCancellation} disabled={saving} className="flex-1">
                {saving ? "Sending..." : "Confirm Cancellation Request"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageBookingPage;
