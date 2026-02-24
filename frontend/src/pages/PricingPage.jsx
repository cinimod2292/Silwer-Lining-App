import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PricingPage = () => {
  const [packages, setPackages] = useState([]);
  const [activeTab, setActiveTab] = useState("");
  const [addOns, setAddOns] = useState([]);

  /* =========================
     FETCH PACKAGES
  ========================== */

  const fetchPackages = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/packages`);
      setPackages(res.data);

      // Set first tab from actual data
      if (res.data.length > 0) {
        const types = [...new Set(res.data.map((p) => p.session_type))];

        setActiveTab((prev) => prev || types[0]);
      }
    } catch (e) {
      console.error("Failed to fetch packages", e);
    }
  }, []);

  /* =========================
     FETCH ADDONS
  ========================== */

  const fetchAddOns = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/addons`);
      setAddOns(res.data);
    } catch (e) {
      console.error("Failed to fetch addons", e);
    }
  }, []);

  /* =========================
     INITIAL LOAD
  ========================== */

  useEffect(() => {
    fetchPackages();
    fetchAddOns();
  }, [fetchPackages, fetchAddOns]);

  /* =========================
     DERIVED DATA
  ========================== */

  const sessionTypes = [
    ...new Set(packages.map((p) => p.session_type)),
  ].map((t) => ({
    id: t,
    name: t
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
  }));

  const getPackagesByType = (type) => {
    return packages.filter((pkg) => pkg.session_type === type);
  };

  /* =========================
     UI
  ========================== */

  return (
    <div className="min-h-screen">

      {/* Header */}
      <section className="bg-warm-sand py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
          <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
            Investment
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6">
            Packages & Pricing
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Each session is carefully designed to provide a refined, stress-free
            experience, with professional guidance, intentional artistry, and
            heirloom-quality images.
          </p>
        </div>
      </section>

      {/* Booking Info */}
      <section className="py-12 bg-primary/5 border-y border-primary/10">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Info className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Booking Process</h3>
          </div>
          <p className="text-muted-foreground text-sm">
            A <strong>50% deposit</strong> secures your booking.
            <strong> No deposit = No booking.</strong>
          </p>
        </div>
      </section>

      {/* Packages */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">

          <Tabs value={activeTab} onValueChange={setActiveTab}>

            <TabsList
              className="grid w-full max-w-xl mx-auto mb-12 bg-warm-sand rounded-full p-1"
              style={{
                gridTemplateColumns: `repeat(${sessionTypes.length}, 1fr)`,
              }}
            >
              {sessionTypes.map((type) => (
                <TabsTrigger
                  key={type.id}
                  value={type.id}
                  className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white text-sm"
                >
                  {type.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {sessionTypes.map((type) => (
              <TabsContent key={type.id} value={type.id}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                  {getPackagesByType(type.id).map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`bg-white rounded-2xl p-8 shadow-soft ${
                        pkg.popular ? "ring-2 ring-primary scale-105" : ""
                      }`}
                    >
                      <div className="text-center mb-6">
                        <h3 className="font-display text-2xl font-semibold">
                          {pkg.name}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {pkg.duration}
                        </p>

                        <p className="font-display text-4xl font-semibold mt-4">
                          R{pkg.price.toLocaleString()}
                        </p>
                      </div>

                      <ul className="space-y-3 mb-8">
                        {pkg.includes.map((item, i) => (
                          <li key={i} className="flex gap-3">
                            <Check className="w-5 h-5 text-primary" />
                            <span className="text-sm">{item}</span>
                          </li>
                        ))}
                      </ul>

                      <Link
                        to={`/booking?type=${type.id}&package=${pkg.name}`}
                      >
                        <Button className="w-full rounded-full">
                          Book This Package
                        </Button>
                      </Link>
                    </div>
                  ))}

                </div>
              </TabsContent>
            ))}

          </Tabs>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-16 md:py-24 bg-warm-sand">
        <div className="max-w-5xl mx-auto px-6 md:px-12">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addOns.map((addon, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-5 flex justify-between shadow-soft"
              >
                <span>{addon.name}</span>
                <span className="font-semibold text-primary">
                  R{addon.price?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

        </div>
      </section>

    </div>
  );
};

export default PricingPage;
