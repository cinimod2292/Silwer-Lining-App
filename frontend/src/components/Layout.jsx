import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X, Instagram, Facebook, Mail, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Silwer Lining Logo
const Logo = ({ className = "h-10" }) => (
  <img 
    src="https://images-pw.pixieset.com/elementfield/1znyRr9/White-Fabric-Podium-1-84dab3dc-1500.jpg" 
    alt="Silwer Lining Photography"
    className={className}
  />
);

export const Layout = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Portfolio", path: "/portfolio" },
    { name: "Packages", path: "/pricing" },
    { name: "About", path: "/about" },
    { name: "Contact", path: "/contact" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "glass shadow-soft py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <nav className="flex items-center justify-between">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 group"
              data-testid="logo-link"
            >
              <img src="/logo-black.png" alt="Silwer Lining Photography" className="h-10 md:h-12" />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-link uppercase text-xs tracking-widest font-medium transition-colors ${
                    isActive(link.path)
                      ? "text-primary"
                      : "text-foreground/80 hover:text-primary"
                  }`}
                  data-testid={`nav-${link.name.toLowerCase()}`}
                >
                  {link.name}
                </Link>
              ))}
              <Link to="/booking">
                <Button
                  className="bg-primary hover:bg-primary/90 text-white rounded-full px-6"
                  data-testid="nav-book-btn"
                >
                  Book Now
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-foreground" />
              ) : (
                <Menu className="w-6 h-6 text-foreground" />
              )}
            </button>
          </nav>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 glass border-t border-border animate-fadeIn">
            <div className="px-6 py-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block uppercase text-sm tracking-widest font-medium py-2 ${
                    isActive(link.path) ? "text-primary" : "text-foreground/80"
                  }`}
                  data-testid={`mobile-nav-${link.name.toLowerCase()}`}
                >
                  {link.name}
                </Link>
              ))}
              <Link to="/booking" className="block pt-2">
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-white rounded-full"
                  data-testid="mobile-book-btn"
                >
                  Book Now
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-20">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-warm-charcoal text-white/90">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="font-display text-2xl font-semibold">
                  Silwer Lining
                </span>
                <span className="text-primary font-display text-sm">Photography</span>
              </div>
              <p className="text-white/60 leading-relaxed max-w-md">
                More than photos - capturing the glow, the love and the memory.
                Professional studio photography in Roodepoort, Johannesburg.
              </p>
              <div className="flex gap-4 mt-6">
                <a
                  href="https://www.instagram.com/silwerliningphotography"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                  data-testid="footer-instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://facebook.com/silwerliningphotography"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                  data-testid="footer-facebook"
                >
                  <Facebook className="w-5 h-5" />
                </a>
                <a
                  href="https://api.whatsapp.com/message/DCYPF37JRDEED1?autoload=1&app_absent=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                  data-testid="footer-whatsapp"
                >
                  <MessageCircle className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-display text-lg mb-4">Quick Links</h4>
              <ul className="space-y-3">
                {navLinks.map((link) => (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      className="text-white/60 hover:text-primary transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-display text-lg mb-4">Get in Touch</h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href="mailto:info@silwerlining.co.za"
                    className="flex items-center gap-2 text-white/60 hover:text-primary transition-colors text-sm"
                    data-testid="footer-email"
                  >
                    <Mail className="w-4 h-4" />
                    info@silwerlining.co.za
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+27636999703"
                    className="flex items-center gap-2 text-white/60 hover:text-primary transition-colors text-sm"
                    data-testid="footer-phone"
                  >
                    <Phone className="w-4 h-4" />
                    063 699 9703
                  </a>
                </li>
                <li className="text-white/60 text-sm">
                  Helderkruin, Roodepoort<br />
                  Johannesburg, Gauteng
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">
              © {new Date().getFullYear()} Silwer Lining Photography. All rights reserved.
            </p>
            <Link
              to="/admin/login"
              className="text-white/30 hover:text-white/50 text-xs transition-colors"
              data-testid="admin-link"
            >
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
