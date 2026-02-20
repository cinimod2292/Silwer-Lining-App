import { useState, useRef, useEffect } from "react";
import { Check, X, PenTool, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const ContractStep = ({ contract, onComplete, clientName }) => {
  const [fieldResponses, setFieldResponses] = useState({});
  const [signatureData, setSignatureData] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [errors, setErrors] = useState({});
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Initialize date fields with current date
  useEffect(() => {
    if (contract?.smart_fields) {
      const initialResponses = {};
      contract.smart_fields.forEach((field) => {
        if (field.type === "date") {
          initialResponses[field.id] = new Date().toISOString();
        }
      });
      setFieldResponses(initialResponses);
    }
  }, [contract]);

  // Setup canvas for signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Set white background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleFieldChange = (fieldId, value) => {
    setFieldResponses((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error for this field
    if (errors[fieldId]) {
      setErrors((prev) => ({ ...prev, [fieldId]: null }));
    }
  };

  // Signature drawing functions
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.type === "mousedown") {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else if (e.type === "touchstart") {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.type === "mousemove") {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else if (e.type === "touchmove") {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // Save signature as base64
      const canvas = canvasRef.current;
      setSignatureData(canvas.toDataURL("image/png"));
      // Clear signature error
      if (errors.signature) {
        setErrors((prev) => ({ ...prev, signature: null }));
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
  };

  const validateAndComplete = () => {
    const newErrors = {};
    let hasErrors = false;

    contract.smart_fields.forEach((field) => {
      if (field.required) {
        if (field.type === "signature") {
          if (!signatureData) {
            newErrors.signature = "Please sign the contract";
            hasErrors = true;
          }
        } else if (field.type === "agree_disagree") {
          if (!fieldResponses[field.id]) {
            newErrors[field.id] = "You must agree to continue";
            hasErrors = true;
          }
        } else if (field.type === "initials") {
          if (!fieldResponses[field.id] || fieldResponses[field.id].trim().length === 0) {
            newErrors[field.id] = "Please enter your initials";
            hasErrors = true;
          }
        }
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    // Complete with all data
    onComplete({
      field_responses: fieldResponses,
      signature_data: signatureData,
      signed_at: new Date().toISOString(),
      client_name: clientName,
    });
  };

  const renderSmartField = (field) => {
    const hasError = errors[field.id];

    switch (field.type) {
      case "agree_disagree":
        return (
          <div key={field.id} className="my-4">
            <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors ${
              hasError ? "border-red-300 bg-red-50" : fieldResponses[field.id] ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50"
            }`}>
              <Checkbox
                id={field.id}
                checked={fieldResponses[field.id] || false}
                onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor={field.id} className="font-medium cursor-pointer">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
              </div>
              {fieldResponses[field.id] && (
                <Check className="w-5 h-5 text-green-600" />
              )}
            </div>
            {hasError && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {hasError}
              </p>
            )}
          </div>
        );

      case "initials":
        return (
          <div key={field.id} className="my-4">
            <Label className="mb-2 block font-medium">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              value={fieldResponses[field.id] || ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value.toUpperCase())}
              placeholder="Enter your initials"
              className={`w-32 text-center text-xl font-semibold uppercase ${
                hasError ? "border-red-300 focus:ring-red-500" : ""
              }`}
              maxLength={5}
            />
            {hasError && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {hasError}
              </p>
            )}
          </div>
        );

      case "date":
        return (
          <div key={field.id} className="my-4">
            <Label className="mb-2 block font-medium">{field.label}</Label>
            <div className="inline-block px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
              📅 {new Date().toLocaleDateString("en-ZA", { 
                year: "numeric", 
                month: "long", 
                day: "numeric" 
              })}
            </div>
          </div>
        );

      case "signature":
        return (
          <div key={field.id} className="my-6">
            <Label className="mb-2 block font-medium">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className={`border-2 rounded-lg overflow-hidden ${
              errors.signature ? "border-red-300" : signatureData ? "border-green-300" : "border-gray-300"
            }`}>
              <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Draw your signature below
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSignature}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className="w-full bg-white cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            {errors.signature && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {errors.signature}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderContractContent = () => {
    if (!contract?.content) return null;

    let content = contract.content;
    
    // Replace placeholders with rendered fields will be done below
    // For now, split content by placeholders and render fields inline
    const parts = [];
    let lastIndex = 0;
    const placeholderRegex = /\{\{([A-Z_0-9]+)\}\}/g;
    let match;

    while ((match = placeholderRegex.exec(content)) !== null) {
      // Add text before placeholder
      if (match.index > lastIndex) {
        parts.push({
          type: "html",
          content: content.substring(lastIndex, match.index),
        });
      }

      // Add the field
      const fieldId = match[1];
      const field = contract.smart_fields.find((f) => f.id === fieldId);
      if (field) {
        parts.push({
          type: "field",
          field: field,
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: "html",
        content: content.substring(lastIndex),
      });
    }

    return parts.map((part, index) => {
      if (part.type === "html") {
        return (
          <div
            key={index}
            className="contract-text"
            dangerouslySetInnerHTML={{ __html: part.content }}
          />
        );
      } else if (part.type === "field") {
        return renderSmartField(part.field);
      }
      return null;
    });
  };

  if (!contract || !contract.content) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No contract configured. Please contact the studio.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="contract-step">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-display font-semibold text-charcoal">
          {contract.title || "Photography Session Contract"}
        </h2>
        <p className="text-muted-foreground mt-2">
          Please read and agree to the terms below
        </p>
      </div>

      <div className="bg-white border rounded-xl p-6 md:p-8 max-h-[60vh] overflow-y-auto">
        {renderContractContent()}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          onClick={validateAndComplete}
          className="bg-primary hover:bg-primary/90 text-white"
          data-testid="complete-contract-btn"
        >
          <Check className="w-4 h-4 mr-2" />
          I Agree & Continue
        </Button>
      </div>

      <style>{`
        .contract-text h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #2D2A26;
        }
        .contract-text h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #2D2A26;
        }
        .contract-text p {
          margin-bottom: 0.75rem;
          line-height: 1.7;
          color: #4a4a4a;
        }
        .contract-text ul, .contract-text ol {
          margin-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .contract-text li {
          margin-bottom: 0.25rem;
          line-height: 1.6;
        }
        .contract-text strong {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default ContractStep;
