import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Clock, Home, RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PaymentReturnPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [booking, setBooking] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const bookingId = searchParams.get("booking_id");
  const pollCountRef = useRef(0);
  const maxPolls = 5;
  const isPollingRef = useRef(false);

  const checkPaymentStatus = async () => {
    try {
      const res = await axios.get(`${API}/payments/status/${bookingId}`);
      setBooking(res.data);
      
      if (res.data.payment_status === "complete" || res.data.status === "confirmed") {
        return "success";
      }
      return "pending";
    } catch (e) {
      console.error("Failed to check payment status", e);
      return "error";
    }
  };

  const verifyWithPayFast = async () => {
    setVerifying(true);
    setErrorMessage("");
    try {
      const res = await axios.post(`${API}/payments/verify`, { booking_id: bookingId });
      
      if (res.data.verified && res.data.status === "complete") {
        await checkPaymentStatus();
        setStatus("success");
        return true;
      } else {
        setErrorMessage(res.data.message || "Payment not yet confirmed");
        setStatus("pending_manual");
        return false;
      }
    } catch (e) {
      console.error("Verification failed", e);
      setErrorMessage("Could not verify payment. Please contact support.");
      setStatus("pending_manual");
      return false;
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (!bookingId) {
      setStatus("error");
      return;
    }

    // Prevent multiple polling cycles
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
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // After max polls, verify with PayFast API
      setStatus("verifying");
      await verifyWithPayFast();
    };

    startPolling();
  }, [bookingId]);

  const formatPrice = (amount) => {
    return `R${(amount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
          {/* Loading State */}
          {status === "loading" && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-gray-400 animate-pulse" />
              </div>
              <h1 className="text-2xl font-display font-semibold mb-2">
                Processing Payment...
              </h1>
              <p className="text-muted-foreground">
                Please wait while we confirm your payment
              </p>
            </>
          )}

          {/* Pending - Waiting for ITN */}
          {status === "pending" && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
              </div>
              <h1 className="text-2xl font-display font-semibold mb-2">
                Confirming Payment...
              </h1>
              <p className="text-muted-foreground mb-6">
                Waiting for confirmation from PayFast
              </p>
              <div className="animate-pulse flex justify-center">
                <div className="h-2 w-32 bg-amber-200 rounded"></div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Checking... ({pollCountRef.current}/{maxPolls})
              </p>
            </>
          )}

          {/* Verifying with PayFast API */}
          {status === "verifying" && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-display font-semibold mb-2">
                Verifying with PayFast...
              </h1>
              <p className="text-muted-foreground">
                Checking payment status directly with PayFast
              </p>
            </>
          )}

          {/* Pending Manual - Need user action */}
          {status === "pending_manual" && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-2xl font-display font-semibold mb-2">
                Payment Pending Verification
              </h1>
              <p className="text-muted-foreground mb-4">
                Your payment is being processed. This can take a few minutes.
              </p>
              
              {errorMessage && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                  {errorMessage}
                </div>
              )}
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={verifyWithPayFast}
                  disabled={verifying}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  {verifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Check Again
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="w-full"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                If your payment was successful, you'll receive a confirmation email shortly.
                <br />
                Contact us if you don't receive confirmation within 30 minutes.
              </p>
            </>
          )}

          {/* Success */}
          {status === "success" && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-display font-semibold mb-2 text-green-800">
                Payment Successful!
              </h1>
              <p className="text-muted-foreground mb-6">
                Your booking has been confirmed. Check your email for details.
              </p>
              
              {booking && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
                  <p className="text-sm text-green-800">
                    <strong>Session:</strong> {booking.session_type?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || "Photography"} Session
                  </p>
                  <p className="text-sm text-green-800">
                    <strong>Package:</strong> {booking.package_name}
                  </p>
                  <p className="text-sm text-green-800">
                    <strong>Total:</strong> {formatPrice(booking.total_price)}
                  </p>
                  {booking.payment_type === "deposit" && (
                    <p className="text-sm text-green-700 mt-2 pt-2 border-t border-green-200">
                      <strong>Deposit Paid:</strong> {formatPrice(booking.amount_paid || booking.total_price / 2)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => navigate("/")}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </div>
            </>
          )}

          {/* Error */}
          {status === "error" && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-display font-semibold mb-2 text-red-800">
                Something Went Wrong
              </h1>
              <p className="text-muted-foreground mb-6">
                We couldn't find your booking. Please contact us for assistance.
              </p>
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="w-full"
                >
                  Back to Home
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Questions? Contact us at{" "}
          <a href="mailto:info@silwerlining.co.za" className="text-primary hover:underline">
            info@silwerlining.co.za
          </a>
        </p>
      </div>
    </div>
  );
};

export default PaymentReturnPage;
