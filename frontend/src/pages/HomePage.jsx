import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Star, Camera, Heart, Users, Baby } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const HomePage = () => {
  const [featuredImages, setFeaturedImages] = useState([]);
  const [testimonials, setTestimonials] = useState([]);

  useEffect(() => {
    fetchPortfolio();
    fetchTestimonials();
  }, []);

  const fetchPortfolio = async () => {
    try {
      const res = await axios.get(`${API}/portfolio?featured_only=true`);
      setFeaturedImages(res.data.slice(0, 6));
    } catch (e) {
      // Use default images if no portfolio items
      setFeaturedImages([
        { id: "1", image_url: "https://images.unsplash.com/photo-1760633549204-f652cef723af", title: "Family Portrait", category: "family" },
        { id: "2", image_url: "https://images.unsplash.com/photo-1644418657862-4ec86e44d6dc", title: "Newborn Dreams", category: "newborn" },
        { id: "3", image_url: "https://images.unsplash.com/photo-1765447551791-b3581cce8207", title: "Maternity Glow", category: "maternity" },
        { id: "4", image_url: "https://images.unsplash.com/photo-1664837024902-5ace3976f806", title: "Individual Portrait", category: "individual" },
      ]);
    }
  };

  const fetchTestimonials = async () => {
    try {
      const res = await axios.get(`${API}/testimonials`);
      setTestimonials(res.data.slice(0, 3));
    } catch (e) {
      setTestimonials([
        { id: "1", client_name: "Sarah M.", content: "The most magical experience! The photos captured every precious moment perfectly.", rating: 5, session_type: "newborn" },
        { id: "2", client_name: "Jennifer L.", content: "Absolutely stunning maternity photos. I felt so comfortable and beautiful.", rating: 5, session_type: "maternity" },
        { id: "3", client_name: "The Anderson Family", content: "Our family photos turned out beyond our expectations. Pure joy captured!", rating: 5, session_type: "family" },
      ]);
    }
  };

  const services = [
    { icon: Baby, title: "Newborn", description: "Delicate portraits capturing your baby's first precious moments" },
    { icon: Heart, title: "Maternity", description: "Celebrating the beauty and anticipation of motherhood" },
    { icon: Users, title: "Family", description: "Timeless portraits that tell your family's unique story" },
    { icon: Camera, title: "Individual", description: "Professional portraits that showcase your authentic self" },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center" data-testid="hero-section">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1760633549204-f652cef723af"
            alt="Family in golden light"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-warm-cream/95 via-warm-cream/70 to-transparent" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 w-full">
          <div className="max-w-2xl">
            <p className="text-primary font-medium tracking-widest uppercase text-sm mb-4 animate-fade-in-up">
              Silwer Lining Photography
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground leading-tight mb-6 animate-fade-in-up delay-100">
              Capturing Life's Most{" "}
              <span className="italic text-primary">Precious</span> Moments
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 animate-fade-in-up delay-200">
              Every photograph tells a story. Let us help you preserve the memories
              that matter most with timeless, artistic imagery.
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((service, index) => (
              <div
                key={service.title}
                className="bg-white rounded-xl p-8 shadow-soft card-hover text-center"
                style={{ animationDelay: `${index * 100}ms` }}
                data-testid={`service-${service.title.toLowerCase()}`}
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <service.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">
                  {service.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {service.description}
                </p>
              </div>
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

      {/* About Preview */}
      <section className="py-20 md:py-32 bg-warm-beige" data-testid="about-preview-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1766228185748-06b625e7ba6a"
                alt="Photographer"
                className="rounded-xl w-full h-[500px] object-cover shadow-soft"
              />
              <div className="absolute -bottom-6 -right-6 bg-white rounded-xl p-6 shadow-soft hidden md:block">
                <p className="font-display text-4xl font-semibold text-primary">10+</p>
                <p className="text-sm text-muted-foreground">Years Experience</p>
              </div>
            </div>

            <div>
              <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
                About Me
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-6">
                Hello, I'm Your Photographer
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                With over a decade of experience in portrait photography, I've dedicated
                my career to capturing the essence of life's most beautiful moments.
                My approach combines artistic vision with genuine connection, creating
                images that tell your unique story.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Every family, every moment, every milestone is precious. I believe in
                creating a comfortable, relaxed atmosphere where authentic emotions
                shine through.
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
              Client Love
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
              What Clients Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className="bg-warm-sand rounded-xl p-8 card-hover"
                data-testid={`testimonial-${index}`}
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="font-accent text-lg italic text-foreground/80 leading-relaxed mb-6">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.client_name}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {testimonial.session_type} Session
                  </p>
                </div>
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
