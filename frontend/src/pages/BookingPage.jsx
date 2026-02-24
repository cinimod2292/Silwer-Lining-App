import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Calendar, Clock, User, Mail, Phone, FileText,
  CheckCircle, Plus, AlertTriangle, CreditCard, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";
import {
  format, isBefore, startOfDay, isWeekend, startOfMonth
} from "date-fns";
import ContractStep from "@/components/ContractStep";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const sessionTypes = [
  { id: "maternity", name: "Maternity" },
  { id: "newborn", name: "Newborn" },
  { id: "studio", name: "Studio Portraits" },
];

const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const payfastFormRef = useRef(null);

  const [step, setStep] = useState(1);
  const [packages, setPackages] = useState([]);
  const [availableAddOns, setAvailableAddOns] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [monthAvailability, setMonthAvailability] = useState({});
  const [displayedMonth, setDisplayedMonth] = useState(startOfMonth(new Date()));
  const [loadingMonth, setLoadingMonth] = useState(false);

  const [bookingSettings, setBookingSettings] = useState(null);
  const [contract, setContract] = useState(null);
  const [contractData, setContractData] = useState(null);

  const [showWeekendPopup, setShowWeekendPopup] = useState(false);
  const [pendingWeekendDate, setPendingWeekendDate] = useState(null);

  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    session_type: searchParams.get("type") || "",
    package_name: searchParams.get("package") || "",
    booking_date: null,
    booking_time: "",
    notes: "",
    selected_addons: [],
    is_weekend: false,
  });

  /* ---------------- FETCH FUNCTIONS (FIXED) ---------------- */

  const fetchPackages = async () => {
    try {
      const res = await axios.get(`${API}/packages`);

      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.packages || [];

      setPackages(data);
    } catch (e) {
      console.error("Failed to fetch packages", e);
      setPackages([]);
    }
  };

  const fetchAddOns = async (sessionType = null) => {
    try {
      let url = `${API}/addons`;
      if (sessionType) url += `?session_type=${sessionType}`;

      const res = await axios.get(url);

      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.addons || [];

      setAvailableAddOns(data);
    } catch (e) {
      console.error("Failed to fetch add-ons", e);
      setAvailableAddOns([]);
    }
  };

  const fetchBookingSettings = async () => {
    try {
      const res = await axios.get(`${API}/booking-settings`);
      setBookingSettings(res.data || {});
    } catch {
      setBookingSettings({ weekend_surcharge: 750 });
    }
  };

  const fetchContract = async () => {
    try {
      const res = await axios.get(`${API}/contract`);
      setContract(res.data?.content ? res.data : null);
    } catch {
      setContract(null);
    }
  };

  const fetchMonthAvailability = useCallback(async (month, sessionType) => {
    const monthStr = format(month, "yyyy-MM");
    setLoadingMonth(true);

    try {
      let url = `${API}/bookings/available-dates?month=${monthStr}`;
      if (sessionType) url += `&session_type=${sessionType}`;

      const res = await axios.get(url);

      const data =
        res.data?.dates && typeof res.data.dates === "object"
          ? res.data.dates
          : {};

      setMonthAvailability(data);
    } catch (e) {
      console.error("Availability error", e);
      setMonthAvailability({});
    } finally {
      setLoadingMonth(false);
    }
  }, []);

  /* ---------------- EFFECTS ---------------- */

  useEffect(() => {
    fetchPackages();
    fetchBookingSettings();
    fetchAddOns();
    fetchContract();
  }, []);

  useEffect(() => {
    fetchMonthAvailability(displayedMonth, formData.session_type);
  }, [displayedMonth, formData.session_type, fetchMonthAvailability]);

  useEffect(() => {
    if (formData.booking_date) {
      const dateStr = format(formData.booking_date, "yyyy-MM-dd");
      const dateInfo = monthAvailability[dateStr];
      setAvailableTimes(dateInfo?.slots || []);
    }
  }, [formData.booking_date, monthAvailability]);

  /* ---------------- SAFE HELPERS ---------------- */

  const getFilteredPackages = () => {
    if (!formData.session_type) return [];

    return Array.isArray(packages)
      ? packages.filter(p => p.session_type === formData.session_type)
      : [];
  };

  const getSelectedPackage = () => {
    if (!Array.isArray(packages)) return null;
    return packages.find(p => p.name === formData.package_name);
  };

  const getSelectedAddons = () => {
    if (!Array.isArray(availableAddOns)) return [];

    return availableAddOns.filter(a =>
      formData.selected_addons.includes(a.id)
    );
  };

  const getWeekendSurcharge = () =>
    bookingSettings?.weekend_surcharge || 500;

  const calculateTotal = () => {
    const pkg = getSelectedPackage();
    const base = pkg?.price || 0;
    const addons = getSelectedAddons()
      .reduce((s, a) => s + a.price, 0);
    const weekend = formData.is_weekend ? getWeekendSurcharge() : 0;

    return base + addons + weekend;
  };

  /* ---------------- HANDLERS ---------------- */

  const handleInputChange = (field, value) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const toggleAddon = (addonId) => {
    setFormData(prev => {
      const exists = prev.selected_addons.includes(addonId);

      return {
        ...prev,
        selected_addons: exists
          ? prev.selected_addons.filter(id => id !== addonId)
          : [...prev.selected_addons, addonId],
      };
    });
  };

  const handleDateSelect = (date) => {
    if (!date) return;

    if (isWeekend(date)) {
      setPendingWeekendDate(date);
      setShowWeekendPopup(true);
    } else {
      setFormData(prev => ({
        ...prev,
        booking_date: date,
        booking_time: "",
        is_weekend: false,
      }));
    }
  };

  const confirmWeekendDate = () => {
    setFormData(prev => ({
      ...prev,
      booking_date: pendingWeekendDate,
      booking_time: "",
      is_weekend: true,
    }));
    setShowWeekendPopup(false);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen">

      {/* Weekend Popup */}
      <Dialog open={showWeekendPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Weekend Surcharge</DialogTitle>
          </DialogHeader>

          <p>
            A surcharge of R{getWeekendSurcharge().toLocaleString()}
            applies for weekend bookings.
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWeekendPopup(false)}
            >
              Cancel
            </Button>

            <Button onClick={confirmWeekendDate}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Example Step 1 UI (rest unchanged in your app) */}

      <div className="max-w-3xl mx-auto p-6">

        <h2 className="text-xl font-semibold mb-4">
          Select Session
        </h2>

        <div className="grid gap-4">

          {getFilteredPackages().map(pkg => (
            <div
              key={pkg.id}
              onClick={() =>
                handleInputChange("package_name", pkg.name)
              }
              className="border p-4 rounded cursor-pointer"
            >
              <div className="flex justify-between">
                <span>{pkg.name}</span>
                <span>R{pkg.price}</span>
              </div>
            </div>
          ))}

        </div>

        <div className="mt-6 font-semibold">
          Total: R{calculateTotal().toLocaleString()}
        </div>

      </div>
    </div>
  );
};

export default BookingPage;
