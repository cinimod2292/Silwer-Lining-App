import { Camera, Award, Heart, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const stats = [
  { icon: Camera, value: "1000+", label: "Sessions Completed" },
  { icon: Award, value: "10+", label: "Years Experience" },
  { icon: Heart, value: "100%", label: "Client Satisfaction" },
  { icon: Clock, value: "2 weeks", label: "Photo Delivery" },
];

const AboutPage = () => {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-warm-sand py-20 md:py-32" data-testid="about-hero">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
                About The Photographer
              </p>
              <h1 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6 leading-tight">
                Hi, I'm Nadia
              </h1>
              <p className="text-muted-foreground leading-relaxed mb-6 text-lg">
                I'm a wife, mother, and passionate photographer with over <strong>10 years of experience</strong>. 
                I specialize in <strong>maternity, motherhood, family, and individual portraits</strong>, 
                capturing timeless images filled with emotion, elegance, and authenticity.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                With a creative background and deep personal connection to the journey of motherhood, 
                I approach each session with care, understanding, and a commitment to telling your unique story.
              </p>
              <Link to="/booking">
                <Button
                  className="bg-primary hover:bg-primary/90 text-white rounded-full px-8"
                  data-testid="about-book-btn"
                >
                  Book Your Session
                </Button>
              </Link>
            </div>
            
            <div className="order-1 lg:order-2 relative">
              <img
                src="https://images-pw.pixieset.com/elementfield/777916812/PORTELLI123-7e8b1649-1500.jpg"
                alt="Nadia - Silwer Lining Photography"
                className="rounded-2xl w-full h-[500px] object-cover shadow-soft"
              />
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl p-6 shadow-soft hidden md:block">
                <p className="font-accent text-lg italic text-foreground/80">
                  "More than photos — capturing the glow, the love and the memory."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-primary" data-testid="about-stats">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center text-white">
                <stat.icon className="w-8 h-8 mx-auto mb-3 opacity-80" />
                <p className="font-display text-3xl md:text-4xl font-semibold mb-1">
                  {stat.value}
                </p>
                <p className="text-sm opacity-80">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 md:py-32" data-testid="about-story">
        <div className="max-w-4xl mx-auto px-6 md:px-12">
          <div className="text-center mb-12">
            <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
              My Story
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
              A Passion for Preserving Memories
            </h2>
          </div>

          <div className="prose prose-lg max-w-none">
            <p className="text-muted-foreground leading-relaxed mb-6">
              Photography, for me, is about more than beautiful images — it's about preserving 
              connection, love, and the fleeting moments that matter most. I invite you to 
              explore my work and see how we can create lasting memories together.
            </p>

            <p className="text-muted-foreground leading-relaxed mb-6">
              My journey began when I realized the power of a single photograph to capture 
              emotions, tell stories, and preserve memories that might otherwise fade with time. 
              What started as a passion has grown into a mission: to help families celebrate 
              and remember their most beautiful moments.
            </p>

            <p className="text-muted-foreground leading-relaxed mb-6">
              Today, I specialize in maternity, newborn, family, baby birthday, and individual 
              portrait photography from my home-based studio in Helderkruin, Roodepoort. 
              My approach is simple: create a warm, relaxed environment where genuine moments 
              unfold naturally. I believe the best photographs happen when people feel 
              comfortable being themselves.
            </p>

            <p className="text-muted-foreground leading-relaxed">
              The studio is booked for only 1 family per slot which makes it private and 
              allows for a relaxing atmosphere. Your session will also not be affected by 
              mother nature. Beautiful outfits and props are provided, so you can focus 
              entirely on enjoying the experience.
            </p>
          </div>
        </div>
      </section>

      {/* Studio */}
      <section className="py-20 md:py-32 bg-warm-beige" data-testid="about-studio">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <img
                src="https://images-pw.pixieset.com/site/Nzv0dL/8LG9jl/BacklitWindow8-e510f7f0-1500.jpg"
                alt="Silwer Lining Photography Studio"
                className="rounded-2xl w-full h-[450px] object-cover shadow-soft"
              />
            </div>
            
            <div>
              <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
                The Studio
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-6">
                Why Choose a Studio Session?
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Private & Intimate</h3>
                    <p className="text-muted-foreground text-sm">
                      The studio is booked for only 1 family per slot, ensuring a completely 
                      private and relaxing atmosphere for your session.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Camera className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Weather Independent</h3>
                    <p className="text-muted-foreground text-sm">
                      Your session won't be affected by mother nature. No need to worry 
                      about rain, wind, or harsh sunlight!
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Outfits & Props Provided</h3>
                    <p className="text-muted-foreground text-sm">
                      Beautiful outfits and props are provided for maternity and newborn sessions. 
                      You can also bring your own special pieces.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-20 md:py-32" data-testid="about-location">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
            Location
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-6">
            Find Us
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            My home-based studio is located in:
          </p>
          <p className="text-xl font-semibold text-foreground mb-2">
            Helderkruin, Roodepoort
          </p>
          <p className="text-muted-foreground mb-8">
            Johannesburg, Gauteng, South Africa
          </p>
          <p className="text-muted-foreground text-sm">
            Sessions are by appointment only, Mon-Fri 9am-4pm.<br />
            Weekend and public holiday sessions available upon request at an additional cost.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-warm-charcoal text-white" data-testid="about-cta">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-6">
            Ready to Tell Your Story?
          </h2>
          <p className="text-white/70 leading-relaxed mb-8 max-w-2xl mx-auto">
            I'd love to hear about your vision and help you create photographs
            that you'll treasure forever. Let's connect and plan something beautiful.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/booking">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white rounded-full px-10"
                data-testid="cta-book-btn"
              >
                Book a Session
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white/30 text-white rounded-full px-10 hover:bg-white/10"
                data-testid="cta-contact-btn"
              >
                Get in Touch
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
