import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, Calendar, Clock, Package, CreditCard, Building2, Check, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CompletePaymentPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentType, setPaymentType] = useState("deposit");
  const [bankDetails, setBankDetails] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [payfastFormData, setPayfastFormData] = useState(null);

  useEffect(() => {
    fetchBooking();
    fetchPaymentSettings();
  }, [bookingId]);

  // Auto-submit PayFast form when data is ready
  useEffect(() => {
    if (payfastFormData && formRef.current) {
      formRef.current.submit();
    }
  }, [payfastFormData]);

  const fetchBooking = async () => {
    try {
      const res = await axios.get(`${API}/payments/status/${bookingId}`);
      setBooking(res.data);
      
      // If already paid, redirect
      if (res.data.payment_status === "complete" || res.data.status === "confirmed") {
        navigate(`/payment/return?booking_id=${bookingId}`);
      }
    } catch (e) {
      toast.error("Booking not found");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const res = await axios.get(`${API}/payment-settings`);
      setPaymentSettings(res.data);
    } catch (e) {
      console.error("Failed to fetch payment settings");
    }
  };

  const formatPrice = (cents) => {
    return `R${((cents || 0) / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setProcessingPayment(true);

    try {
      const res = await axios.post(`${API}/payments/initiate`, {
        booking_id: bookingId,
        payment_method: paymentMethod,
        payment_type: paymentType
      });

      if (paymentMethod === "payfast") {
        // Set form data and auto-submit
        setPayfastFormData(res.data.form_data);
      } else if (paymentMethod === "eft") {
        setBankDetails(res.data.bank_details);
        toast.success("Bank details ready - please complete your transfer");
      }
    } catch (e) {
      toast.error("Failed to initiate payment");
      setProcessingPayment(false);
    }
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
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Booking not found</p>
          <Button onClick={() => navigate("/")} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const depositAmount = Math.round((booking.total_price || 0) * 0.5);
  const fullAmount = booking.total_price || 0;

  return (
    <div className="min-h-screen bg-warm-cream py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Camera className="w-8 h-8 text-primary" />
            <span className="font-display text-2xl font-semibold">Silwer Lining</span>
          </div>
          <h1 className="text-3xl font-display font-semibold">Complete Your Payment</h1>
          <p className="text-muted-foreground mt-2">Finish your booking by completing the payment</p>
        </div>

        {/* Booking Summary */}
        <div className="bg-white rounded-2xl shadow-soft p-6 mb-6">
          <h2 className="font-semibold text-lg mb-4">Booking Summary</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Package className="w-5 h-5 text-primary" />
              <span className="capitalize">{booking.session_type} - {booking.package_name}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-5 h-5 text-primary" />
              <span>{booking.booking_date}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-5 h-5 text-primary" />
              <span>{booking.booking_time}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <span className="font-medium">Total</span>
            <span className="text-2xl font-display font-semibold text-primary">
              {formatPrice(fullAmount)}
            </span>
          </div>
        </div>

        {/* Bank Details Display */}
        {bankDetails && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-green-800">Bank Transfer Details</h2>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>Bank:</strong> {bankDetails.bank_name}</p>
              <p><strong>Account Holder:</strong> {bankDetails.account_holder}</p>
              <p><strong>Account Number:</strong> {bankDetails.account_number}</p>
              <p><strong>Branch Code:</strong> {bankDetails.branch_code}</p>
              <p><strong>Account Type:</strong> {bankDetails.account_type}</p>
              <div className="mt-4 p-3 bg-white rounded-lg border border-green-300">
                <p className="text-xs text-muted-foreground mb-1">Reference (important!)</p>
                <p className="font-mono font-bold text-lg">{bankDetails.reference}</p>
              </div>
              <p className="mt-4 text-green-700">
                <strong>Amount to Pay:</strong> {formatPrice(paymentType === "deposit" ? depositAmount : fullAmount)}
              </p>
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Please use the reference above when making your payment. Your booking will be confirmed once payment is verified.
              </p>
            </div>
            <Button 
              onClick={() => navigate("/")} 
              className="w-full mt-6 bg-primary hover:bg-primary/90 text-white"
            >
              Done
            </Button>
          </div>
        )}

        {/* Payment Form */}
        {!bankDetails && (
          <>
            {/* Payment Amount Selection */}
            <div className="bg-white rounded-2xl shadow-soft p-6 mb-6">
              <Label className="text-base font-semibold mb-4 block">
                Payment Amount
              </Label>
              <RadioGroup 
                value={paymentType} 
                onValueChange={setPaymentType}
                className="space-y-3"
              >
                <label 
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentType === "deposit" 
                      ? "border-primary bg-primary/5" 
                      : "border-gray-200 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="deposit" id="deposit" />
                    <div>
                      <p className="font-medium">50% Deposit</p>
                      <p className="text-sm text-muted-foreground">Pay the rest on the day</p>
                    </div>
                  </div>
                  <span className="text-xl font-display font-semibold text-primary">
                    {formatPrice(depositAmount)}
                  </span>
                </label>
                
                <label 
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentType === "full" 
                      ? "border-primary bg-primary/5" 
                      : "border-gray-200 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="full" id="full" />
                    <div>
                      <p className="font-medium">Full Payment</p>
                      <p className="text-sm text-muted-foreground">Pay everything now</p>
                    </div>
                  </div>
                  <span className="text-xl font-display font-semibold text-primary">
                    {formatPrice(fullAmount)}
                  </span>
                </label>
              </RadioGroup>
            </div>

            {/* Payment Method Selection */}
            <div className="bg-white rounded-2xl shadow-soft p-6 mb-6">
              <Label className="text-base font-semibold mb-4 block">
                Payment Method
              </Label>
              <div className="space-y-3">
                {/* PayFast */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("payfast")}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                    paymentMethod === "payfast"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      paymentMethod === "payfast" ? "bg-primary/20" : "bg-gray-100"
                    }`}>
                      <CreditCard className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">PayFast</p>
                      <p className="text-sm text-muted-foreground">
                        Credit/Debit Card, Instant EFT
                      </p>
                    </div>
                  </div>
                  {paymentMethod === "payfast" && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>

                {/* Manual EFT */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod("eft")}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                    paymentMethod === "eft"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      paymentMethod === "eft" ? "bg-green-100" : "bg-gray-100"
                    }`}>
                      <Building2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Manual EFT / Bank Transfer</p>
                      <p className="text-sm text-muted-foreground">
                        Transfer directly to our bank account
                      </p>
                    </div>
                  </div>
                  {paymentMethod === "eft" && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
              </div>
            </div>

            {/* Pay Button */}
            <Button
              onClick={handlePayment}
              disabled={!paymentMethod || processingPayment}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-white text-lg"
            >
              {processingPayment ? "Processing..." : `Pay ${formatPrice(paymentType === "deposit" ? depositAmount : fullAmount)}`}
            </Button>
          </>
        )}

        {/* Hidden PayFast Form */}
        {payfastFormData && (
          <form 
            ref={formRef}
            action="https://sandbox.payfast.co.za/eng/process" 
            method="POST"
            style={{ display: 'none' }}
          >
            {Object.entries(payfastFormData).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
          </form>
        )}
      </div>
    </div>
  );
};

export default CompletePaymentPage;
