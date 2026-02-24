import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  Calendar,
  Clock,
  Package,
  Mail,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CompleteBookingPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [completed, setCompleted] = useState(false);

  const [bookingData, setBookingData] = useState(null);
  const [packages, setPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [questionnaire, setQuestionnaire] = useState(null);

  const [formData, setFormData] = useState({
    package_id: "",
    package_name: "",
    package_price: 0,
    selected_addons: [],
    addons_total: 0,
    client_phone: "",
    notes: "",
    questionnaire_responses: {},
  });

  /* =========================
     FETCH BOOKING DATA
  ========================== */

  const fetchBookingData = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API}/booking-token/${token}`
      );

      setBookingData(res.data.booking);
      setPackages(res.data.packages || []);
      setAddons(res.data.addons || []);
      setQuestionnaire(res.data.questionnaire);

      // Init questionnaire responses
      if (res.data.questionnaire?.questions) {
        const initial = {};

        res.data.questionnaire.questions.forEach(
          (q) => {
            initial[q.id] =
              q.type === "checkbox" ? [] : "";
          }
        );

        setFormData((prev) => ({
          ...prev,
          questionnaire_responses: initial,
        }));
      }

      // Prefill phone
      if (res.data.booking?.client_phone) {
        setFormData((prev) => ({
          ...prev,
          client_phone:
            res.data.booking.client_phone,
        }));
      }
    } catch (e) {
      setError(
        e.response?.data?.detail ||
          "This booking link is invalid or expired."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBookingData();
  }, [fetchBookingData]);

  /* =========================
     HELPERS
  ========================== */

  const calculateTotal = () => {
    return (
      formData.package_price +
      formData.addons_total
    );
  };

  const handlePackageSelect = (pkg) => {
    setFormData((prev) => ({
      ...prev,
      package_id: pkg.id,
      package_name: pkg.name,
      package_price: pkg.price,
    }));
  };

  const toggleAddon = (addonId, addonPrice) => {
    setFormData((prev) => {
      const current = prev.selected_addons;

      if (current.includes(addonId)) {
        return {
          ...prev,
          selected_addons: current.filter(
            (id) => id !== addonId
          ),
          addons_total:
            prev.addons_total - addonPrice,
        };
      }

      return {
        ...prev,
        selected_addons: [
          ...current,
          addonId,
        ],
        addons_total:
          prev.addons_total + addonPrice,
      };
    });
  };

  const handleQuestionnaireChange = (
    questionId,
    value,
    isCheckbox = false
  ) => {
    setFormData((prev) => {
      const responses = {
        ...prev.questionnaire_responses,
      };

      if (isCheckbox) {
        const current =
          responses[questionId] || [];

        responses[questionId] =
          current.includes(value)
            ? current.filter(
                (v) => v !== value
              )
            : [...current, value];
      } else {
        responses[questionId] = value;
      }

      return {
        ...prev,
        questionnaire_responses: responses,
      };
    });
  };

  /* =========================
     SUBMIT BOOKING
  ========================== */

  const handleSubmit = useCallback(async () => {
    if (!formData.package_id) {
      toast.error("Please select a package");
      return;
    }

    setSubmitting(true);

    try {
      await axios.post(
        `${API}/booking-token/${token}/complete`,
        {
          ...formData,
          total_price:
            formData.package_price +
            formData.addons_total,
        }
      );

      setCompleted(true);
      toast.success(
        "Booking completed successfully!"
      );
    } catch (e) {
      toast.error(
        e.response?.data?.detail ||
          "Failed to complete booking"
      );
    } finally {
      setSubmitting(false);
    }
  }, [token, formData]);

  /* =========================
     STATES
  ========================== */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {error}
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CheckCircle className="w-12 h-12 text-green-500" />
      </div>
    );
  }

  /* =========================
     UI
  ========================== */

  return (
    <div className="min-h-screen bg-warm-cream py-12 px-6">
      <div className="max-w-3xl mx-auto">

        <h1 className="text-3xl font-semibold mb-6">
          Complete Your Booking
        </h1>

        {/* Package Example */}
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            onClick={() =>
              handlePackageSelect(pkg)
            }
            className="border p-4 mb-3 cursor-pointer"
          >
            {pkg.name} — R
            {pkg.price?.toLocaleString()}
          </div>
        ))}

        {/* Total */}
        <div className="mb-6 font-semibold">
          Total: R
          {calculateTotal().toLocaleString()}
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !formData.package_id
          }
        >
          {submitting
            ? "Confirming..."
            : "Confirm Booking"}
        </Button>

      </div>
    </div>
  );
};

export default CompleteBookingPage;

