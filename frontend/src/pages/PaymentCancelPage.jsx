import { useSearchParams, useNavigate } from "react-router-dom";
import { XCircle, Home, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentCancelPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const bookingId = searchParams.get("booking_id");

  return (
    <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-amber-600" />
          </div>
          
          <h1 className="text-2xl font-display font-semibold mb-2">
            Payment Cancelled
          </h1>
          <p className="text-muted-foreground mb-6">
            Your payment was cancelled. Don't worry, your booking has been saved and you can complete the payment anytime.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800">
              Your booking is being held for <strong>24 hours</strong>. Complete your payment before it expires.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {bookingId && (
              <Button 
                onClick={() => navigate(`/complete-payment/${bookingId}`)}
                className="w-full bg-primary hover:bg-primary/90 text-white"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button 
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Need help? Contact us at{" "}
          <a href="mailto:info@silwerlining.co.za" className="text-primary hover:underline">
            info@silwerlining.co.za
          </a>
        </p>
      </div>
    </div>
  );
};

export default PaymentCancelPage;
