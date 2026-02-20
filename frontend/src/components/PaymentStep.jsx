import { useState } from "react";
import { CreditCard, Building2, Clock, Check, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const PaymentStep = ({ 
  booking, 
  totalPrice, 
  onPaymentInitiated, 
  onSkipPayment,
  loading 
}) => {
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentType, setPaymentType] = useState("deposit");
  const [bankDetails, setBankDetails] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  const depositAmount = Math.round(totalPrice * 0.5);
  const fullAmount = totalPrice;

  const formatPrice = (cents) => {
    return `R${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  };

  const handlePaymentMethodSelect = (method) => {
    setPaymentMethod(method);
    setBankDetails(null);
  };

  const handleProceedToPayment = async () => {
    if (!paymentMethod) return;

    setProcessingPayment(true);

    try {
      const amount = paymentType === "deposit" ? depositAmount : fullAmount;
      
      // Call parent to initiate payment
      await onPaymentInitiated({
        payment_method: paymentMethod,
        payment_type: paymentType,
        amount: amount
      });
    } catch (error) {
      console.error("Payment initiation failed:", error);
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="payment-step">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-display font-semibold text-charcoal">
          Payment
        </h2>
        <p className="text-muted-foreground mt-2">
          Choose your payment method and amount
        </p>
      </div>

      {/* Payment Amount Selection */}
      <div className="bg-white border rounded-xl p-6">
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
                <p className="text-sm text-muted-foreground">Secure your booking now, pay the rest later</p>
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
                <p className="text-sm text-muted-foreground">Pay the full amount now</p>
              </div>
            </div>
            <span className="text-xl font-display font-semibold text-primary">
              {formatPrice(fullAmount)}
            </span>
          </label>
        </RadioGroup>
      </div>

      {/* Payment Method Selection */}
      <div className="bg-white border rounded-xl p-6">
        <Label className="text-base font-semibold mb-4 block">
          Payment Method
        </Label>
        <div className="space-y-3">
          {/* PayFast */}
          <button
            type="button"
            onClick={() => handlePaymentMethodSelect("payfast")}
            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "payfast"
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-primary/50"
            }`}
            data-testid="payment-payfast"
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
                  Credit/Debit Card, Instant EFT, SnapScan
                </p>
              </div>
            </div>
            {paymentMethod === "payfast" && (
              <Check className="w-5 h-5 text-primary" />
            )}
          </button>

          {/* PayFlex */}
          <button
            type="button"
            onClick={() => handlePaymentMethodSelect("payflex")}
            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "payflex"
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-primary/50"
            }`}
            data-testid="payment-payflex"
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                paymentMethod === "payflex" ? "bg-purple-100" : "bg-gray-100"
              }`}>
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">PayFlex</p>
                <p className="text-sm text-muted-foreground">
                  Pay in 4 interest-free instalments
                </p>
              </div>
            </div>
            {paymentMethod === "payflex" && (
              <Check className="w-5 h-5 text-primary" />
            )}
          </button>

          {/* Manual EFT */}
          <button
            type="button"
            onClick={() => handlePaymentMethodSelect("eft")}
            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "eft"
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-primary/50"
            }`}
            data-testid="payment-eft"
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

      {/* PayFlex Notice */}
      {paymentMethod === "payflex" && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-800">
              <p className="font-medium">PayFlex Coming Soon</p>
              <p>PayFlex integration is being set up. Please choose another payment method for now.</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button
          variant="outline"
          onClick={onSkipPayment}
          className="flex-1"
          disabled={processingPayment}
        >
          Pay Later
        </Button>
        <Button
          onClick={handleProceedToPayment}
          disabled={!paymentMethod || paymentMethod === "payflex" || processingPayment}
          className="flex-1 bg-primary hover:bg-primary/90 text-white gap-2"
          data-testid="proceed-payment-btn"
        >
          {processingPayment ? (
            "Processing..."
          ) : (
            <>
              Proceed to Pay {formatPrice(paymentType === "deposit" ? depositAmount : fullAmount)}
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Your booking will be held for 24 hours. Complete payment to confirm.
      </p>
    </div>
  );
};

export default PaymentStep;
