import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Clock, Home, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PaymentReturnPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [booking, setBooking] = useState(null);

  const bookingId = searchParams.get("booking_id");

  useEffect(() => {
    if (!bookingId) {
      setStatus("error");
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const res = await axios.get(`${API}/payments/status/${bookingId}`);
        setBooking(res.data);
        
        if (res.data.payment_status === "complete" || res.data.status === "confirmed") {
          setStatus("success");
        } else if (res.data.payment_status === "pending") {
          setStatus("pending");
          // Keep polling
          setTimeout(checkPaymentStatus, 3000);
        } else {
          setStatus("pending");
          setTimeout(checkPaymentStatus, 3000);
        }
      } catch (e) {
        console.error("Failed to check payment status", e);
        setStatus("error");
      }
    };

    checkPaymentStatus();
  }, [bookingId]);

  const formatPrice = (cents) => {
    return `R${((cents || 0) / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
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

          {status === "pending" && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
              </div>
              <h1 className="text-2xl font-display font-semibold mb-2">
                Confirming Payment...
              </h1>
              <p className="text-muted-foreground mb-6">
                We're waiting for confirmation from the payment provider
              </p>
              <div className="animate-pulse flex justify-center">
                <div className="h-2 w-32 bg-amber-200 rounded"></div>
              </div>
            </>
          )}

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
                    <strong>Amount Paid:</strong> {formatPrice(booking.amount_paid)}
                  </p>
                  {booking.payment_type === "deposit" && (
                    <p className="text-sm text-green-700 mt-1">
                      Remaining balance: {formatPrice(booking.total_price - booking.amount_paid)}
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

          {status === "error" && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-display font-semibold mb-2 text-red-800">
                Something Went Wrong
              </h1>
              <p className="text-muted-foreground mb-6">
                We couldn't verify your payment. Please contact us if you believe this is an error.
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
