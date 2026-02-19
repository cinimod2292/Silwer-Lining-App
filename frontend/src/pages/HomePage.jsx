import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Star, Heart, Users, Baby, Sparkles, Gift, Camera, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const HomePage = () => {
  const [featuredImages, setFeaturedImages] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [instagramPosts, setInstagramPosts] = useState([]);
  const [faqs, setFaqs] = useState([]);

  useEffect(() => {
    fetchPortfolio();
    fetchTestimonials();
    fetchInstagramFeed();
    fetchFAQs();
  }, []);

  const fetchPortfolio = async () => {
    try {
      const res = await axios.get(`${API}/portfolio?featured_only=true`);
      if (res.data.length > 0) {
        setFeaturedImages(res.data.slice(0, 6));
      } else {
        setFeaturedImages(defaultFeaturedImages);
      }
    } catch (e) {
      setFeaturedImages(defaultFeaturedImages);
    }
  };

  const fetchTestimonials = async () => {
    try {
      const res = await axios.get(`${API}/testimonials`);
      if (res.data.length > 0) {
        setTestimonials(res.data.slice(0, 6));
      } else {
        setTestimonials(defaultTestimonials);
      }
    } catch (e) {
      setTestimonials(defaultTestimonials);
    }
  };

  const fetchInstagramFeed = async () => {
    try {
      const res = await axios.get(`${API}/instagram/feed`);
      if (res.data.posts && res.data.posts.length > 0) {
        setInstagramPosts(res.data.posts);
      }
    } catch (e) {
      console.error("Instagram feed not available");
    }
  };

  const fetchFAQs = async () => {
    try {
      const res = await axios.get(`${API}/faqs`);
      if (res.data.length > 0) {
        setFaqs(res.data);
      } else {
        setFaqs(defaultFAQs);
      }
    } catch (e) {
      setFaqs(defaultFAQs);
    }
  };

  // Real images from silwerlining.co.za
  const defaultFeaturedImages = [
    { id: "1", image_url: "https://images-pw.pixieset.com/site/Nzv0dL/6wok7k/_DSC5179-a4f71fe2-1500.jpg", title: "Maternity Elegance", category: "maternity" },
    { id: "2", image_url: "https://images-pw.pixieset.com/site/Nzv0dL/64qae3/_DSC2696_1-6b4a07cb-1500.jpg", title: "Newborn Dreams", category: "newborn" },
    { id: "3", image_url: "https://images-pw.pixieset.com/site/Nzv0dL/WDdooa/SILWERLININGPHOTOGRAPHY-LUMI50-591942a0-1500.jpg", title: "Baby Birthday", category: "baby-birthday" },
    { id: "4", image_url: "https://images-pw.pixieset.com/site/Nzv0dL/Ayr5KK/MONGALEFAMILYPHOTOS6-e9c3fdd0-1500.jpg", title: "Family Portrait", category: "family" },
  ];

  // Real testimonials from silwerlining.co.za
  const defaultTestimonials = [
    { 
      id: "1", 
      client_name: "Tracey", 
      content: "Dear Nadia, I am absolutely thrilled with my pictures! I can't express how grateful I am for the incredible work you've done. The final results exceeded my expectations, and I am truly in love with every single shot. Thank you so much for your dedication and talent. I will forever cherish these memories!", 
      rating: 5, 
      session_type: "maternity",
      image_url: "https://images-pw.pixieset.com/elementfield/anDwMDM/_DSC9449-16b529a8-1500.JPG"
    },
    { 
      id: "2", 
      client_name: "Thandiwe", 
      content: "Awwww Nads! These are absolutely gorgeous! Literally in tears 🥹 Thank you so much for your services. I'll definitely be seeing you soon!", 
      rating: 5, 
      session_type: "maternity",
      image_url: "https://images-pw.pixieset.com/elementfield/Q0WZqp7/6-3b2695ce-1500.jpg"
    },
    { 
      id: "3", 
      client_name: "Keke", 
      content: "THEY ARE ABSOLUTELY BEAUTIFUL 😭😭, we love every single one of them and honestly can not thank you enough for the amazing work.", 
      rating: 5, 
      session_type: "maternity",
      image_url: "https://images-pw.pixieset.com/elementfield/493211912/25-d88898f9.jpg"
    },
    { 
      id: "4", 
      client_name: "Jaquerene", 
      content: "Thank you so much for the beautiful photos. Can't believe it's actually me. We are so extremely happy with the outcome. Will definitely recommend you to others. May God bless you and your business as you make mommies' dreams come true.", 
      rating: 5, 
      session_type: "maternity",
      image_url: "https://images-pw.pixieset.com/elementfield/893211912/2-1917f955.JPG"
    },
    { 
      id: "5", 
      client_name: "Landi, Christo & Kahleb", 
      content: "Ag vreeslik dankie! Ons is so happy - dit het so mooi uitgekom! Ons gaan mekaar beslis weer sien vir shoots. Hierdie is kosbare memories, dankie dat jy dit so special gemaak het.", 
      rating: 5, 
      session_type: "baby-birthday",
      image_url: "https://images-pw.pixieset.com/elementfield/204211912/3-ddd5aa05.JPG"
    },
    { 
      id: "6", 
      client_name: "Jimaysha", 
      content: "Just wanted to say I absolutely love the pictures and I am extremely happy with how they all came out. Thank you for everything and for being so patient with us lol. We will definitely be back soon.", 
      rating: 5, 
      session_type: "newborn",
      image_url: "https://images-pw.pixieset.com/elementfield/675463912/4-28667fc2.JPG"
    },
  ];

  const services = [
    { icon: Heart, title: "Maternity", description: "Celebrating the beauty and anticipation of motherhood", image: "https://images-pw.pixieset.com/site/Nzv0dL/6wok7k/_DSC5179-a4f71fe2-1500.jpg", link: "/portfolio?category=maternity" },
    { icon: Baby, title: "Newborn", description: "Delicate portraits capturing your baby's first precious moments", image: "https://images-pw.pixieset.com/site/Nzv0dL/64qae3/_DSC2696_1-6b4a07cb-1500.jpg", link: "/portfolio?category=newborn" },
    { icon: Sparkles, title: "Baby Birthday", description: "Milestone celebrations and cake smash sessions", image: "https://images-pw.pixieset.com/site/Nzv0dL/WDdooa/SILWERLININGPHOTOGRAPHY-LUMI50-591942a0-1500.jpg", link: "/portfolio?category=baby-birthday" },
    { icon: Users, title: "Family", description: "Timeless portraits that tell your family's unique story", image: "https://images-pw.pixieset.com/site/Nzv0dL/Ayr5KK/MONGALEFAMILYPHOTOS6-e9c3fdd0-1500.jpg", link: "/portfolio?category=family" },
    { icon: Gift, title: "Adult Birthday", description: "Celebrate your milestones with stunning portraits", image: "https://images-pw.pixieset.com/site/Nzv0dL/WomqQY/_DSC7012-34e9895c-1500.jpg", link: "/portfolio?category=adult-birthday" },
    { icon: Camera, title: "Brand/Product", description: "Professional product and brand photography", image: "https://images-pw.pixieset.com/site/Nzv0dL/70GxyA/_DSC6154-17ae8b12-1500.jpg", link: "/portfolio?category=brand-product" },
  ];

  // Default FAQs (fallback if API empty)
  const defaultFAQs = [
    { id: "1", question: "Where are you located?", answer: "My studio is home-based in Helderkruin, Roodepoort JHB." },
    { id: "2", question: "When should I book?", answer: "Bookings need to be made at least 3 months in advance, especially for weekend dates. Last minute bookings are also welcome!" },
    { id: "3", question: "Do you provide outfits?", answer: "Yes! Beautiful outfits are provided for maternity and newborn sessions. You can also bring your own special pieces." },
    { id: "4", question: "When will I get my photos?", answer: "Editing is done within 2 weeks after confirmation of your final selections (excluding public holidays and weekends)." },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center" data-testid="hero-section">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images-pw.pixieset.com/elementfield/1znyRr9/White-Fabric-Podium-1-84dab3dc-1500.jpg"
            alt="Silwer Lining Photography Studio"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-warm-cream/95 via-warm-cream/70 to-transparent" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 w-full">
          <div className="max-w-2xl">
            <p className="text-primary font-medium tracking-widest uppercase text-sm mb-4 animate-fade-in-up">
              Luxury Studio Photoshoots
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-tight mb-6 animate-fade-in-up delay-100">
              More Than Photos —{" "}
              <span className="italic text-primary">Capturing</span> the Glow, the Love & the Memory
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 animate-fade-in-up delay-200">
              Professional studio photography in Roodepoort, Johannesburg. Specializing in maternity, 
              newborn, family & portrait sessions with beautiful, styled shoots and outfits provided.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up delay-300">
              <Link to="/booking">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 gap-2"
                  data-testid="hero-book-btn"
                >
                  Book Your Session
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/portfolio">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 border-foreground/20 rounded-full px-8 hover:bg-foreground/5"
                  data-testid="hero-portfolio-btn"
                >
                  View Portfolio
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 md:py-32 bg-warm-sand" data-testid="services-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
              Our Services
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
              Photography for Every Milestone
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <Link
                key={service.title}
                to={service.link}
                className="group relative overflow-hidden rounded-xl aspect-[4/5] card-hover"
                style={{ animationDelay: `${index * 100}ms` }}
                data-testid={`service-${service.title.toLowerCase().replace(/\s/g, '-')}`}
              >
                <img 
                  src={service.image} 
                  alt={service.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="font-display text-2xl font-semibold mb-2">
                    {service.title}
                  </h3>
                  <p className="text-white/80 text-sm">
                    {service.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/pricing">
              <Button
                variant="outline"
                className="border-2 border-primary text-primary rounded-full px-8 hover:bg-primary hover:text-white"
                data-testid="view-packages-btn"
              >
                View All Packages
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Work */}
      <section className="py-20 md:py-32" data-testid="featured-work-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
            <div>
              <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
                Featured Work
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
                Recent Sessions
              </h2>
            </div>
            <Link to="/portfolio" className="mt-4 md:mt-0">
              <Button
                variant="ghost"
                className="text-primary gap-2 hover:bg-primary/10"
                data-testid="view-all-btn"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredImages.map((item, index) => (
              <div
                key={item.id}
                className={`img-zoom rounded-xl overflow-hidden ${
                  index === 0 ? "md:col-span-2 md:row-span-2" : ""
                }`}
                data-testid={`featured-image-${index}`}
              >
                <img
                  src={item.image_url}
                  alt={item.title}
                  className={`w-full object-cover ${
                    index === 0 ? "h-full min-h-[400px]" : "h-64"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instagram Recent Shoots */}
      {instagramPosts.length > 0 && (
        <section className="py-20 md:py-32 bg-warm-beige" data-testid="instagram-section">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
              <div>
                <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
                  <Instagram className="w-4 h-4 inline mr-2" />
                  Follow Along
                </p>
                <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
                  Recent Shoots
                </h2>
              </div>
              <a 
                href="https://www.instagram.com/silwerliningphotography" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-4 md:mt-0"
              >
                <Button
                  variant="ghost"
                  className="text-primary gap-2 hover:bg-primary/10"
                >
                  @silwerliningphotography
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {instagramPosts.map((post, index) => (
                <a
                  key={post.id}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-xl overflow-hidden group"
                  data-testid={`instagram-post-${index}`}
                >
                  <img
                    src={post.image_url}
                    alt={post.caption || "Instagram post"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About Preview */}
      <section className="py-20 md:py-32 bg-warm-beige" data-testid="about-preview-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="relative">
              <img
                src="https://images-pw.pixieset.com/elementfield/170321823/PORTELLI1-2c5a22f1-1500.jpg"
                alt="Nadia - Silwer Lining Photography"
                className="rounded-xl w-full h-[500px] object-cover shadow-soft"
              />
              <div className="absolute -bottom-6 -right-6 bg-white rounded-xl p-6 shadow-soft hidden md:block">
                <p className="font-display text-4xl font-semibold text-primary">10+</p>
                <p className="text-sm text-muted-foreground">Years Experience</p>
              </div>
            </div>

            <div>
              <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
                About The Photographer
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-6">
                Hi, I'm Nadia
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                I'm a wife, mother, and passionate photographer with over 10 years of experience. 
                I specialize in <strong>maternity, motherhood, family, and individual portraits</strong>, 
                capturing timeless images filled with emotion, elegance, and authenticity.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                With a creative background and deep personal connection to the journey of motherhood, 
                I approach each session with care, understanding, and a commitment to telling your unique story.
                Photography, for me, is about more than beautiful images — it's about preserving connection, 
                love, and the fleeting moments that matter most.
              </p>
              <Link to="/about">
                <Button
                  className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 gap-2"
                  data-testid="learn-more-btn"
                >
                  Learn More
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-32" data-testid="testimonials-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
              What Clients Say
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
              Testimonials
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.slice(0, 6).map((testimonial, index) => (
              <div
                key={testimonial.id}
                className="bg-warm-sand rounded-xl p-6 card-hover"
                data-testid={`testimonial-${index}`}
              >
                {testimonial.image_url && (
                  <img 
                    src={testimonial.image_url} 
                    alt={testimonial.client_name}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                )}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="font-accent text-base italic text-foreground/80 leading-relaxed mb-4">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-semibold text-foreground">— {testimonial.client_name}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {testimonial.session_type?.replace('-', ' ')} Session
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="py-20 md:py-32 bg-warm-sand" data-testid="faq-section">
        <div className="max-w-4xl mx-auto px-6 md:px-12">
          <div className="text-center mb-12">
            <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
              FAQ
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { q: "Where are you located?", a: "My studio is home-based in Helderkruin, Roodepoort JHB." },
              { q: "When should I book?", a: "Bookings need to be made at least 3 months in advance, especially for weekend dates. Last minute bookings are also welcome!" },
              { q: "Do you provide outfits?", a: "Yes! Beautiful outfits are provided for maternity and newborn sessions. You can also bring your own special pieces." },
              { q: "When will I get my photos?", a: "Editing is done within 2 weeks after confirmation of your final selections (excluding public holidays and weekends)." },
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-soft">
                <h3 className="font-semibold text-foreground mb-2">{faq.q}</h3>
                <p className="text-muted-foreground text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-warm-charcoal text-white" data-testid="cta-section">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-semibold mb-6">
            Ready to Create Beautiful Memories?
          </h2>
          <p className="text-white/70 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Let's capture your special moments together. Book your session today
            and let's create something beautiful.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/booking">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white rounded-full px-10"
                data-testid="cta-book-btn"
              >
                Book Now
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white/30 text-white rounded-full px-10 hover:bg-white/10"
                data-testid="cta-contact-btn"
              >
                Contact Me
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
