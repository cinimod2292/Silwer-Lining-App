```jsx
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Star,
  Heart,
  Users,
  Baby,
  Sparkles,
  Gift,
  Camera,
  Instagram,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

/* ================= API ================= */

const API =
  process.env.REACT_APP_BACKEND_URL
    ? `${process.env.REACT_APP_BACKEND_URL}/api`
    : "http://localhost:8000/api";

/* ================= COMPONENT ================= */

const HomePage = () => {
  const [featuredImages, setFeaturedImages] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [googleReviews, setGoogleReviews] = useState({
    reviews: [],
    google_url: "",
  });
  const [instagramPosts, setInstagramPosts] = useState([]);
  const [faqs, setFaqs] = useState([]);

  const [hero, setHero] = useState({
    subtitle: "Luxury Studio Photoshoots",
    title_line1: "More Than Photos —",
    title_highlight: "Capturing",
    title_line2: "the Glow, the Love & the Memory",
    description:
      "Professional studio photography in Roodepoort, Johannesburg.",
    image_url:
      "https://images-pw.pixieset.com/elementfield/1znyRr9/White-Fabric-Podium-1-84dab3dc-1500.jpg",
    image_opacity: 100,
    overlay_opacity: 70,
    button1_text: "Book Your Session",
    button2_text: "View Portfolio",
  });

  /* ================= FETCHERS ================= */

  const fetchHero = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/hero-settings`);
      setHero((prev) => ({ ...prev, ...res.data }));
    } catch (e) {
      console.log("Hero defaults used");
    }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API}/portfolio?featured_only=true`
      );
      setFeaturedImages(res.data || []);
    } catch {
      setFeaturedImages([]);
    }
  }, []);

  const fetchTestimonials = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/testimonials`);
      setTestimonials(res.data || []);
    } catch {
      setTestimonials([]);
    }
  }, []);

  const fetchGoogleReviews = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API}/google-reviews/public`
      );
      setGoogleReviews(res.data);
    } catch {
      console.log("No Google reviews");
    }
  }, []);

  const fetchInstagramFeed = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/instagram/feed`);
      setInstagramPosts(res.data?.posts || []);
    } catch {
      console.log("Instagram not configured");
    }
  }, []);

  const fetchFAQs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/faqs`);
      setFaqs(res.data || []);
    } catch {
      setFaqs([]);
    }
  }, []);

  /* ================= LOAD ================= */

  useEffect(() => {
    fetchHero();
    fetchPortfolio();
    fetchTestimonials();
    fetchGoogleReviews();
    fetchInstagramFeed();
    fetchFAQs();
  }, [
    fetchHero,
    fetchPortfolio,
    fetchTestimonials,
    fetchGoogleReviews,
    fetchInstagramFeed,
    fetchFAQs,
  ]);

  /* ================= UI ================= */

  return (
    <div>
      {/* HERO */}
      <section className="relative min-h-[90vh] flex items-center">
        <img
          src={hero.image_url}
          className="absolute inset-0 w-full h-full object-cover"
          alt=""
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <h1 className="text-5xl font-semibold mb-4">
            {hero.title_line1}{" "}
            <span className="italic">
              {hero.title_highlight}
            </span>{" "}
            {hero.title_line2}
          </h1>

          <p className="mb-6">{hero.description}</p>

          <Link to="/booking">
            <Button className="gap-2">
              {hero.button1_text}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* SIMPLE PLACEHOLDER */}
      <div className="p-10 text-center">
        <h2 className="text-2xl font-semibold">
          Homepage Loaded Successfully ✅
        </h2>
      </div>
    </div>
  );
};

export default HomePage;
```
