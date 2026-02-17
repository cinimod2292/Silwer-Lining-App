import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const sessionTypes = [
  { id: "maternity", name: "Maternity" },
  { id: "newborn", name: "Newborn" },
  { id: "studio", name: "Studio Portraits" },
];

const addOns = [
  { name: "Makeup artist", price: "Inquire" },
  { name: "Additional edited images", price: "Inquire" },
  { name: "Weekend/Public holiday session", price: "R500" },
  { name: "Rush editing", price: "Inquire" },
  { name: "Additional prints", price: "Inquire" },
];

const PricingPage = () => {
  const [packages, setPackages] = useState([]);
  const [activeTab, setActiveTab] = useState("maternity");

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await axios.get(`${API}/packages`);
      setPackages(res.data);
    } catch (e) {
      console.error("Failed to fetch packages", e);
    }
  };

  const getPackagesByType = (type) => {
    return packages.filter((pkg) => pkg.session_type === type);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-warm-sand py-20 md:py-28" data-testid="pricing-header">
        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
          <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
            Investment
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6">
            Packages & Pricing
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Each session is carefully designed to provide a refined, stress-free experience, 
            with professional guidance, intentional artistry, and heirloom-quality images.
          </p>
        </div>
      </section>

      {/* Investment Info */}
      <section className="py-12 bg-primary/5 border-y border-primary/10">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Info className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Booking Process</h3>
          </div>
          <p className="text-muted-foreground text-sm">
            To book, select your preferred package and date. Once completed, you'll receive an invoice 
            and your <strong>50% deposit</strong> will be required to secure your booking. 
            <strong> No deposit = No booking.</strong>
          </p>
        </div>
      </section>

      {/* Packages */}
      <section className="py-16 md:py-24" data-testid="packages-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-xl mx-auto grid-cols-3 mb-12 bg-warm-sand rounded-full p-1">
              {sessionTypes.map((type) => (
                <TabsTrigger
                  key={type.id}
                  value={type.id}
                  className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white text-sm"
                  data-testid={`tab-${type.id}`}
                >
                  {type.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {sessionTypes.map((type) => (
              <TabsContent key={type.id} value={type.id}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {getPackagesByType(type.id).map((pkg, index) => (
                    <div
                      key={pkg.id}
                      className={`bg-white rounded-2xl p-8 shadow-soft relative ${
                        pkg.popular ? "ring-2 ring-primary scale-105 z-10" : ""
                      } card-hover`}
                      data-testid={`package-${pkg.id}`}
                    >
                      {pkg.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-semibold px-4 py-1 rounded-full">
                          Most Popular
                        </div>
                      )}
                      <div className="text-center mb-6">
                        <h3 className="font-display text-2xl font-semibold mb-2">
                          {pkg.name}
                        </h3>
                        <p className="text-muted-foreground text-sm">{pkg.duration}</p>
                        <div className="mt-4">
                          <span className="text-sm text-muted-foreground">Starting at</span>
                          <p className="font-display text-4xl font-semibold text-foreground">
                            R{pkg.price.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <ul className="space-y-3 mb-8">
                        {pkg.includes.map((item, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-foreground/80">{item}</span>
                          </li>
                        ))}
                      </ul>

                      <Link to={`/booking?type=${type.id}&package=${pkg.name}`}>
                        <Button
                          className={`w-full rounded-full ${
                            pkg.popular
                              ? "bg-primary hover:bg-primary/90 text-white"
                              : "bg-foreground/5 hover:bg-foreground/10 text-foreground"
                          }`}
                          data-testid={`book-${pkg.id}`}
                        >
                          Book This Package
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Request Guide CTA */}
          <div className="text-center mt-16 p-8 bg-warm-sand rounded-2xl">
            <h3 className="font-display text-2xl font-semibold mb-4">
              Want More Details?
            </h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Request our full investment guide to see all available options, 
              including add-ons, prints, and album pricing.
            </p>
            <Link to="/contact">
              <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 gap-2">
                Request Investment Guide
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-16 md:py-24 bg-warm-sand" data-testid="addons-section">
        <div className="max-w-5xl mx-auto px-6 md:px-12">
          <div className="text-center mb-12">
            <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
              Enhance Your Session
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
              Available Add-Ons
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addOns.map((addon, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-5 flex items-center justify-between shadow-soft"
                data-testid={`addon-${index}`}
              >
                <span className="text-foreground">{addon.name}</span>
                <span className="font-semibold text-primary">{addon.price}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Policies */}
      <section className="py-16 md:py-24" data-testid="policies-section">
        <div className="max-w-4xl mx-auto px-6 md:px-12">
          <div className="text-center mb-12">
            <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
              Booking Fees & Policies
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
              Important Information
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-warm-sand rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">Deposit Required</h3>
              <p className="text-muted-foreground text-sm">
                A 50% deposit is required to secure your booking. The remaining balance is due 
                before or on the day of your session.
              </p>
            </div>
            <div className="bg-warm-sand rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">Cancellation Fee</h3>
              <p className="text-muted-foreground text-sm">
                Cancellation fee is 25% of your invoiced total.
              </p>
            </div>
            <div className="bg-warm-sand rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">Reschedule Fee</h3>
              <p className="text-muted-foreground text-sm">
                A R550 fee applies when you request a reschedule of your shoot date.
              </p>
            </div>
            <div className="bg-warm-sand rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-2">Weekend Sessions</h3>
              <p className="text-muted-foreground text-sm">
                Weekend and public holiday sessions are available at an additional cost of R500.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-warm-charcoal text-white" data-testid="pricing-cta">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-6">
            Not Sure Which Package is Right for You?
          </h2>
          <p className="text-white/70 leading-relaxed mb-8 max-w-2xl mx-auto">
            Every family is unique. Let's chat about your vision and find the perfect
            session to capture your special moments.
          </p>
          <Link to="/contact">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-10 gap-2"
              data-testid="pricing-contact-btn"
            >
              Get in Touch
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default PricingPage;
