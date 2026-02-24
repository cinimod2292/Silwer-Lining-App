import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Camera,
  Calendar,
  Clock,
  Package,
  CreditCard,
  Building2,
  Check,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
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

  /* =========================
     FETCH BOOKING
  ========================== */

  const fetchBooking = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API}/payments/status/${bookingId}`
      );

      setBooking(res.data);

      if (
        res.data.payment_status === "complete" ||
        res.data.status === "confirmed"
      ) {
        navigate(
          `/payment/return?booking_id=${bookingId}`
        );
      }
    } catch (e) {
      toast.error("Booking not found");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [bookingId, navigate]);

  /* =========================
     FETCH PAYMENT SETTINGS
  ========================== */

  const fetchPaymentSettings = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API}/payment-settings`
      );
      setPaymentSettings(res.data);
    } catch (e) {
      console.error(
        "Failed to fetch payment settings",
        e
      );
    }
  }, []);

  /* =========================
     INITIAL LOAD
  ========================== */

  useEffect(() => {
    fetchBooking();
    fetchPaymentSettings();
  }, [fetchBooking, fetchPaymentSettings]);

  /* =========================
     AUTO SUBMIT PAYFAST
  ========================== */

  useEffect(() => {
    if (payfastFormData && formRef.current) {
      formRef.current.submit();
    }
  }, [payfastFormData]);

  /* =========================
     HANDLE PAYMENT
  ========================== */

  const handlePayment = useCallback(async () => {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    setProcessingPayment(true);

    try {
      const res = await axios.post(
        `${API}/payments/initiate`,
        {
          booking_id: bookingId,
          payment_method: paymentMethod,
          payment_type: paymentType,
        }
      );

      if (paymentMethod === "payfast") {
        setPayfastFormData(res.data.form_data);
      }

      if (paymentMethod === "eft") {
        setBankDetails(res.data.bank_details);
        toast.success(
          "Bank details ready - please complete transfer"
        );
      }
    } catch (e) {
      toast.error("Failed to initiate payment");
      setProcessingPayment(false);
    }
  }, [bookingId, paymentMethod, paymentType]);

  /* =========================
     HELPERS
  ========================== */

  const formatPrice = (cents) => {
    return `R${((cents || 0) / 100).toLocaleString(
      "en-ZA",
      { minimumFractionDigits: 2 }
    )}`;
  };

  /* =========================
     LOADING
  ========================== */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Booking not found
      </div>
    );
  }

  const depositAmount = Math.round(
    (booking.total_price || 0) * 0.5
  );
  const fullAmount = booking.total_price || 0;

  /* =========================
     UI
  ========================== */

  return (
    <div className="min-h-screen bg-warm-cream py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <Camera className="w-8 h-8 text-primary mx-auto mb-2" />
          <h1 className="text-3xl font-display font-semibold">
            Complete Your Payment
          </h1>
        </div>

        {/* Summary */}
        <div className="bg-white p-6 rounded-2xl shadow-soft mb-6">
          <p className="font-semibold">
            {booking.package_name}
          </p>
          <p>{formatPrice(fullAmount)}</p>
        </div>

        {/* Bank Details */}
        {bankDetails && (
          <div className="bg-green-50 p-6 rounded-2xl mb-6">
            <CheckCircle className="w-6 h-6 text-green-600 mb-2" />
            <p>
              Reference:{" "}
              <strong>{bankDetails.reference}</strong>
            </p>
          </div>
        )}

        {/* Payment Button */}
        {!bankDetails && (
          <Button
            onClick={handlePayment}
            disabled={
              !paymentMethod || processingPayment
            }
            className="w-full"
          >
            {processingPayment
              ? "Processing..."
              : `Pay ${formatPrice(
                  paymentType === "deposit"
                    ? depositAmount
                    : fullAmount
                )}`}
          </Button>
        )}

        {/* Hidden PayFast Form */}
        {payfastFormData && (
          <form
            ref={formRef}
            action="https://sandbox.payfast.co.za/eng/process"
            method="POST"
            style={{ display: "none" }}
          >
            {Object.entries(
              payfastFormData
            ).map(([key, value]) => (
              <input
                key={key}
                type="hidden"
                name={key}
                value={value}
              />
            ))}
          </form>
        )}

      </div>
    </div>
  );
};

export default CompletePaymentPage;
