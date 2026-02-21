import { useState, useEffect } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import {
  Camera, LayoutDashboard, Calendar, Image, MessageSquare,
  Mail, LogOut, Menu, X, ChevronRight, Package, Settings, CalendarDays,
  Tag, Users, Clock, RefreshCcw, ClipboardList, HelpCircle, CalendarRange, FileSignature, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";

// Admin sub-pages
import DashboardHome from "./DashboardHome";
import BookingsManage from "./BookingsManage";
import PackagesManage from "./PackagesManage";
import BookingSettingsPage from "./BookingSettingsPage";
import CalendarSettingsPage from "./CalendarSettingsPage";
import AdminCalendarPage from "./AdminCalendarPage";
import PortfolioManage from "./PortfolioManage";
import TestimonialsManage from "./TestimonialsManage";
import MessagesManage from "./MessagesManage";
import AddOnsManage from "./AddOnsManage";
import EmailTemplatesManage from "./EmailTemplatesManage";
import SettingsPage from "./SettingsPage";
import QuestionnairesManage from "./QuestionnairesManage";
import FAQManage from "./FAQManage";
import ContractManage from "./ContractManage";
import PaymentSettingsPage from "./PaymentSettingsPage";
import AutomatedRemindersPage from "./AutomatedRemindersPage";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
      return;
    }
    
    const name = localStorage.getItem("admin_name");
    setAdminName(name || "Admin");
    
    // Verify token
    verifyAuth();
  }, [navigate]);

  const verifyAuth = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      await axios.get(`${API}/admin/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_name");
      navigate("/admin/login");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_name");
    toast.success("Logged out successfully");
    navigate("/admin/login");
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
    { icon: CalendarRange, label: "Calendar View", path: "/admin/calendar-view" },
    { icon: Calendar, label: "Bookings", path: "/admin/bookings" },
    { icon: Package, label: "Packages", path: "/admin/packages" },
    { icon: Tag, label: "Add-ons", path: "/admin/addons" },
    { icon: ClipboardList, label: "Questionnaires", path: "/admin/questionnaires" },
    { icon: FileSignature, label: "Contract", path: "/admin/contract" },
    { icon: CreditCard, label: "Payments", path: "/admin/payments" },
    { icon: Clock, label: "Booking Settings", path: "/admin/booking-settings" },
    { icon: CalendarDays, label: "Calendar Sync", path: "/admin/calendar" },
    { icon: Mail, label: "Auto Reminders", path: "/admin/reminders" },
    { icon: Image, label: "Portfolio", path: "/admin/portfolio" },
    { icon: Users, label: "Testimonials", path: "/admin/testimonials" },
    { icon: HelpCircle, label: "FAQs", path: "/admin/faqs" },
    { icon: MessageSquare, label: "Messages", path: "/admin/messages" },
    { icon: Settings, label: "Settings", path: "/admin/settings" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-warm-sand flex" data-testid="admin-dashboard">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-warm-charcoal text-white transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/10">
            <Link to="/" className="flex items-center gap-2">
              <Camera className="w-6 h-6 text-primary" />
              <span className="font-display text-xl font-semibold">Silwer Lining</span>
            </Link>
            <p className="text-white/50 text-sm mt-1">Admin Panel</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.path)
                    ? "bg-primary text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User & Logout */}
          <div className="p-4 border-t border-white/10">
            <div className="px-4 py-2 mb-2">
              <p className="text-white/50 text-xs">Logged in as</p>
              <p className="font-medium">{adminName}</p>
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3 text-white/70 hover:text-white hover:bg-white/10"
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white shadow-soft px-6 py-4 flex items-center justify-between lg:justify-end">
          <button
            className="lg:hidden p-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="mobile-menu-btn"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          
          {/* Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 text-sm">
            <Link to="/admin/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            {location.pathname !== "/admin/dashboard" && (
              <>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground capitalize">
                  {location.pathname.split("/").pop().replace("-", " ")}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          <Routes>
            <Route path="dashboard" element={<DashboardHome />} />
            <Route path="bookings" element={<BookingsManage />} />
            <Route path="packages" element={<PackagesManage />} />
            <Route path="addons" element={<AddOnsManage />} />
            <Route path="questionnaires" element={<QuestionnairesManage />} />
            <Route path="contract" element={<ContractManage />} />
            <Route path="booking-settings" element={<BookingSettingsPage />} />
            <Route path="calendar" element={<CalendarSettingsPage />} />
            <Route path="calendar-view" element={<AdminCalendarPage />} />
            <Route path="payments" element={<PaymentSettingsPage />} />
            <Route path="reminders" element={<AutomatedRemindersPage />} />
            <Route path="portfolio" element={<PortfolioManage />} />
            <Route path="testimonials" element={<TestimonialsManage />} />
            <Route path="faqs" element={<FAQManage />} />
            <Route path="messages" element={<MessagesManage />} />
            <Route path="email-templates" element={<EmailTemplatesManage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<DashboardHome />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
