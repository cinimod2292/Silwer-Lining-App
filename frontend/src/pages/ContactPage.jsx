import { useState, useEffect } from "react";
import { Mail, Phone, MapPin, Clock, Send, Instagram, Facebook, MessageCircle } from "lucide-react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      value: "info@silwerlining.co.za",
      link: "mailto:info@silwerlining.co.za",
    },
    {
      icon: Phone,
      title: "WhatsApp Call",
      value: "063 699 9703",
      link: "tel:+27636999703",
    },
    {
      icon: MessageCircle,
      title: "WhatsApp Chat",
      value: "Click to chat",
      link: "https://api.whatsapp.com/message/DCYPF37JRDEED1?autoload=1&app_absent=0",
    },
    {
      icon: MapPin,
      title: "Studio Location",
      value: "Helderkruin, Roodepoort, Gauteng",
      link: null,
    },
    {
      icon: Clock,
      title: "Hours",
      value: "Mon-Fri: 9am-4pm (By Appointment)",
      link: null,
    },
  ];

  const shootTypes = [
    "Maternity",
    "Newborn",
    "Family",
    "Baby Milestone/Birthday",
    "Adult Birthday/Photos",
    "Brand/Product",
    "Other",
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
            Contact Us
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
                          target={item.link.startsWith("http") ? "_blank" : undefined}
                          rel={item.link.startsWith("http") ? "noopener noreferrer" : undefined}
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
                    href="https://www.instagram.com/silwerliningphotography"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-warm-sand flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                    data-testid="social-instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a
                    href="https://facebook.com/silwerliningphotography"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-warm-sand flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                    data-testid="social-facebook"
                  >
                    <Facebook className="w-5 h-5" />
                  </a>
                  <a
                    href="https://api.whatsapp.com/message/DCYPF37JRDEED1?autoload=1&app_absent=0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-warm-sand flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                    data-testid="social-whatsapp"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>
                </div>
              </div>

              {/* Image */}
              <div className="mt-10 hidden lg:block">
                <img
                  src="https://images-pw.pixieset.com/elementfield/Q0WZqp7/6-3b2695ce-1500.jpg"
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
                      <Label htmlFor="phone" className="mb-2 block">
                        Contact Number <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="063 699 9703"
                        value={formData.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        className="h-12"
                        data-testid="input-phone"
                      />
                    </div>
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

                  <div>
                    <Label htmlFor="subject" className="mb-2 block">
                      Type of Shoot? <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formData.subject} onValueChange={(v) => handleChange("subject", v)}>
                      <SelectTrigger className="h-12" data-testid="select-subject">
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        {shootTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-warm-sand" data-testid="contact-faq">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-6">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mt-10">
            {[
              {
                q: "Do you shoot/book weekends?",
                a: "Shoots take place between Mon-Fri 9am-4pm. Weekend and public holiday sessions are available upon request at an additional cost of R500.",
              },
              {
                q: "Where am I located?",
                a: "My studio is home-based in Helderkruin, Roodepoort JHB.",
              },
              {
                q: "Do you provide hair and makeup?",
                a: "Makeup services are an add-on option. Hair is NOT provided - this should be arranged by you and done before you arrive for your session.",
              },
              {
                q: "How far in advance should I book?",
                a: "Bookings need to be made at least 3 months in advance, especially for weekend dates. Last minute bookings are also welcome where possible.",
              },
              {
                q: "When will I get my photos?",
                a: "Editing is done within 2 weeks after confirmation of your final selections (excluding public holidays and weekends).",
              },
              {
                q: "Do you have a cancellation fee?",
                a: "Yes, it is 25% of your invoiced total.",
              },
              {
                q: "Do you have a reschedule fee?",
                a: "Yes, it is R550 and is applicable when you request a reschedule of your shoot date.",
              },
              {
                q: "Why do a studio session?",
                a: "The studio is booked for only 1 family per slot which makes it private and allows for a relaxing atmosphere. Your session will also not be affected by mother nature.",
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
