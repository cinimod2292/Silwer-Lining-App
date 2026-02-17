import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminLogin = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin/login`, {
        email: formData.email,
        password: formData.password,
      });
      localStorage.setItem("admin_token", res.data.token);
      localStorage.setItem("admin_name", res.data.name);
      toast.success("Welcome back!");
      navigate("/admin/dashboard");
    } catch (e) {
      if (e.response?.status === 401) {
        toast.error("Invalid email or password");
      } else {
        toast.error("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Please enter your name");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/admin/setup`, formData);
      toast.success("Admin account created! Please log in.");
      setIsSetup(false);
    } catch (e) {
      if (e.response?.status === 400) {
        toast.error("Admin already exists. Please log in.");
        setIsSetup(false);
      } else {
        toast.error("Setup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-warm-sand flex items-center justify-center px-6" data-testid="admin-login-page">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Camera className="w-8 h-8 text-primary" />
            <span className="font-display text-2xl font-semibold text-foreground">
              Silwer Lining
            </span>
          </div>
          <p className="text-muted-foreground">Admin Dashboard</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-soft p-8">
          <h1 className="font-display text-2xl font-semibold text-center mb-6">
            {isSetup ? "Create Admin Account" : "Welcome Back"}
          </h1>

          <form onSubmit={isSetup ? handleSetup : handleLogin} className="space-y-5">
            {isSetup && (
              <div>
                <Label htmlFor="name" className="mb-2 block">
                  Full Name
                </Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="h-12"
                  data-testid="input-name"
                />
              </div>
            )}

            <div>
              <Label htmlFor="email" className="mb-2 block">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@silwerlining.com"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="h-12 pl-12"
                  data-testid="input-email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="mb-2 block">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className="h-12 pl-12 pr-12"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white rounded-full h-12"
              data-testid="submit-btn"
            >
              {loading ? "Please wait..." : isSetup ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSetup(!isSetup)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="toggle-setup"
            >
              {isSetup ? "Already have an account? Sign in" : "First time? Create admin account"}
            </button>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to website
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
