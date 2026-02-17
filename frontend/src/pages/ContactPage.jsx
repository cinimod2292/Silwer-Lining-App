import { useState } from "react";
import { Mail, Phone, MapPin, Clock, Send, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/contact`, formData);
      toast.success("Message sent successfully! We'll be in touch soon.");
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    } catch (e) {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      title: "Email",
      value: "hello@silwerlining.com",
      link: "mailto:hello@silwerlining.com",
    },
    {
      icon: Phone,
      title: "Phone",
      value: "(555) 123-4567",
      link: "tel:+15551234567",
    },
    {
      icon: MapPin,
      title: "Studio Location",
      value: "123 Photography Lane, Suite 100",
      link: null,
    },
    {
      icon: Clock,
      title: "Hours",
      value: "Mon-Fri: 9am-6pm, Sat: By Appointment",
      link: null,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-warm-sand py-20 md:py-28" data-testid="contact-header">
        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
          <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
            Get in Touch
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6">
            Let's Start a Conversation
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Have questions about our services? Ready to book? Or just want to say hello?
            We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 md:py-24" data-testid="contact-section">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Contact Info */}
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-8">
                Contact Information
              </h2>
              
              <div className="space-y-6 mb-10">
                {contactInfo.map((item, index) => (
                  <div key={index} className="flex items-start gap-4" data-testid={`contact-info-${index}`}>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      {item.link ? (
                        <a
                          href={item.link}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">{item.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Social Links */}
              <div>
                <h3 className="font-semibold text-foreground mb-4">Follow Us</h3>
                <div className="flex gap-4">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-warm-sand flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                    data-testid="social-instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-warm-sand flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                    data-testid="social-facebook"
                  >
                    <Facebook className="w-5 h-5" />
                  </a>
                </div>
              </div>

              {/* Image */}
              <div className="mt-10 hidden lg:block">
                <img
                  src="https://images.unsplash.com/photo-1761395105130-c77ea4a8e3ab"
                  alt="Studio"
                  className="rounded-2xl w-full h-64 object-cover shadow-soft"
                />
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <div className="bg-white rounded-2xl shadow-soft p-8 md:p-10">
                <h2 className="font-display text-2xl font-semibold text-foreground mb-6">
                  Send a Message
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-6" data-testid="contact-form">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="name" className="mb-2 block">
                        Full Name <span className="text-destructive">*</span>
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
                    <div>
                      <Label htmlFor="email" className="mb-2 block">
                        Email Address <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        className="h-12"
                        data-testid="input-email"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="phone" className="mb-2 block">
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        className="h-12"
                        data-testid="input-phone"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject" className="mb-2 block">
                        Subject <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="subject"
                        placeholder="What's this about?"
                        value={formData.subject}
                        onChange={(e) => handleChange("subject", e.target.value)}
                        className="h-12"
                        data-testid="input-subject"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="message" className="mb-2 block">
                      Message <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us about your vision, questions, or anything else..."
                      value={formData.message}
                      onChange={(e) => handleChange("message", e.target.value)}
                      rows={5}
                      data-testid="input-message"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-white rounded-full h-12 gap-2"
                    data-testid="submit-btn"
                  >
                    {loading ? (
                      "Sending..."
                    ) : (
                      <>
                        Send Message
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ or Additional Info */}
      <section className="py-16 md:py-24 bg-warm-sand" data-testid="contact-faq">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-6">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mt-10">
            {[
              {
                q: "How far in advance should I book?",
                a: "We recommend booking at least 2-4 weeks in advance, especially for maternity and newborn sessions.",
              },
              {
                q: "Do you travel for sessions?",
                a: "Yes! We offer on-location sessions within a 30-mile radius. Travel fees may apply for longer distances.",
              },
              {
                q: "What should we wear?",
                a: "We provide a detailed style guide after booking. Generally, neutral tones and coordinated (not matching) outfits work best.",
              },
              {
                q: "How long until we receive our photos?",
                a: "Your online gallery will be ready within 2-3 weeks. Rush delivery is available for an additional fee.",
              },
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-soft" data-testid={`faq-${index}`}>
                <h3 className="font-semibold text-foreground mb-2">{faq.q}</h3>
                <p className="text-muted-foreground text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
