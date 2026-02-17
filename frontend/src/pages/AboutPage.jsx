import { Camera, Award, Heart, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const stats = [
  { icon: Camera, value: "2,500+", label: "Sessions Completed" },
  { icon: Award, value: "10+", label: "Years Experience" },
  { icon: Heart, value: "100%", label: "Client Satisfaction" },
  { icon: Clock, value: "48hr", label: "Gallery Delivery" },
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
                About Me
              </p>
              <h1 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6 leading-tight">
                The Heart Behind the Lens
              </h1>
              <p className="text-muted-foreground leading-relaxed mb-6 text-lg">
                Hello! I'm the photographer behind Silwer Lining Photography. With over a
                decade of experience capturing life's most precious moments, I've dedicated
                my career to creating timeless images that families treasure for generations.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                My journey began when I realized the power of a single photograph to
                capture emotions, tell stories, and preserve memories that might
                otherwise fade with time. What started as a passion has grown into
                a mission: to help families celebrate and remember their most
                beautiful moments.
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
                src="https://images.unsplash.com/photo-1766228185748-06b625e7ba6a"
                alt="Photographer"
                className="rounded-2xl w-full h-[500px] object-cover shadow-soft"
              />
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl p-6 shadow-soft hidden md:block">
                <p className="font-accent text-lg italic text-foreground/80">
                  "Every photo tells a story worth preserving."
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
              Photography found me at a pivotal moment in my life. As a new mother, I
              was overwhelmed by how quickly my children were growing and how fleeting
              each stage of their lives seemed to be. I picked up a camera determined
              to capture every precious moment, and in doing so, discovered my calling.
            </p>

            <p className="text-muted-foreground leading-relaxed mb-6">
              What began as documenting my own family's journey soon evolved into a
              deep passion for helping other families do the same. I pursued formal
              training, studied under renowned photographers, and spent years
              perfecting my craft. Every workshop, every challenging shoot, every
              late night editing taught me something new about the art of capturing
              authentic emotion.
            </p>

            <p className="text-muted-foreground leading-relaxed mb-6">
              Today, I specialize in maternity, newborn, family, and individual
              portrait photography. My approach is simple: create a warm, relaxed
              environment where genuine moments unfold naturally. I believe the
              best photographs happen when people feel comfortable being themselves.
            </p>

            <p className="text-muted-foreground leading-relaxed">
              When I'm not behind the camera, you'll find me spending time with my
              own family, exploring local hiking trails, or discovering new coffee
              shops around town. I believe in living fully and capturing those moments
              of joy, love, and connection—both for my clients and in my own life.
            </p>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-20 md:py-32 bg-warm-beige" data-testid="about-philosophy">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <img
                src="https://images.unsplash.com/photo-1761395105130-c77ea4a8e3ab"
                alt="Photography studio"
                className="rounded-2xl w-full h-[450px] object-cover shadow-soft"
              />
            </div>
            
            <div>
              <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
                My Philosophy
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-6">
                Creating Art from Real Moments
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Connection First</h3>
                    <p className="text-muted-foreground text-sm">
                      I take time to know each family, understanding what makes them unique
                      before we ever start shooting.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Camera className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Artistry & Authenticity</h3>
                    <p className="text-muted-foreground text-sm">
                      My images blend artistic composition with genuine emotion—beautiful
                      photographs that feel true to who you are.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Excellence in Every Detail</h3>
                    <p className="text-muted-foreground text-sm">
                      From the initial consultation to the final delivery, every aspect
                      of your experience is crafted with care.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
