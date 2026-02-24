import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  Clock,
  Home,
  RefreshCw,
  Mail,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PaymentReturnPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("loading");
  const [booking, setBooking] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const bookingId = searchParams.get("booking_id");

  const pollCountRef = useRef(0);
  const maxPolls = 5;
  const isPollingRef = useRef(false);

  /* =========================
     CHECK PAYMENT STATUS
  ========================== */

  const checkPaymentStatus = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API}/payments/status/${bookingId}`
      );

      setBooking(res.data);

      if (
        res.data.payment_status === "complete" ||
        res.data.status === "confirmed"
      ) {
        return "success";
      }

      return "pending";
    } catch (e) {
      console.error("Failed to check payment status", e);
      return "error";
    }
  }, [bookingId]);

  /* =========================
     VERIFY WITH PAYFAST
  ========================== */

  const verifyWithPayFast = useCallback(async () => {
    setVerifying(true);
    setErrorMessage("");

    try {
      const res = await axios.post(
        `${API}/payments/verify`,
        { booking_id: bookingId }
      );

      if (res.data.verified && res.data.status === "complete") {
        await checkPaymentStatus();
        setStatus("success");
        return true;
      } else {
        setErrorMessage(
          res.data.message || "Payment not yet confirmed"
        );
        setStatus("pending_manual");
        return false;
      }
    } catch (e) {
      console.error("Verification failed", e);
      setErrorMessage(
        "Could not verify payment. Please contact support."
      );
      setStatus("pending_manual");
      return false;
    } finally {
      setVerifying(false);
    }
  }, [bookingId, checkPaymentStatus]);

  /* =========================
     POLLING EFFECT
  ========================== */

  useEffect(() => {
    if (!bookingId) {
      setStatus("error");
      return;
    }

    if (isPollingRef.current) return;
    isPollingRef.current = true;

    const startPolling = async () => {
      while (pollCountRef.current < maxPolls) {
        const result = await checkPaymentStatus();

        if (result === "success") {
          setStatus("success");
          return;
        }

        pollCountRef.current += 1;
        setStatus("pending");

        if (pollCountRef.current < maxPolls) {
          await new Promise((resolve) =>
            setTimeout(resolve, 3000)
          );
        }
      }

      setStatus("verifying");
      await verifyWithPayFast();
    };

    startPolling();
  }, [bookingId, checkPaymentStatus, verifyWithPayFast]);

  /* =========================
     FORMAT PRICE
  ========================== */

  const formatPrice = (amount) => {
    return `R${(amount || 0).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
    })}`;
  };

  /* =========================
     UI
  ========================== */

  return (
    <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
      <div className="max-w-md w-full">

        <div className="bg-white rounded-2xl shadow-soft p-8 text-center">

          {/* SUCCESS */}
          {status === "success" && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>

              <h1 className="text-2xl font-display font-semibold mb-2 text-green-800">
                Payment Successful!
              </h1>

              {booking && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
                  <p className="text-sm text-green-800">
                    <strong>Package:</strong> {booking.package_name}
                  </p>
                  <p className="text-sm text-green-800">
                    <strong>Total:</strong>{" "}
                    {formatPrice(booking.total_price)}
                  </p>
                </div>
              )}

              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </>
          )}

          {/* ERROR */}
          {status === "error" && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>

              <h1 className="text-2xl font-display font-semibold mb-2 text-red-800">
                Something Went Wrong
              </h1>

              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full"
              >
                Back to Home
              </Button>
            </>
          )}

        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Questions? Contact{" "}
          <a
            href="mailto:info@silwerlining.co.za"
            className="text-primary hover:underline"
          >
            info@silwerlining.co.za
          </a>
        </p>

      </div>
    </div>
  );
};

export default PaymentReturnPage;
