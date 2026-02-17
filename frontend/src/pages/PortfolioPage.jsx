import { useState, useEffect } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const categories = [
  { id: "all", name: "All" },
  { id: "maternity", name: "Maternity" },
  { id: "newborn", name: "Newborn" },
  { id: "family", name: "Family" },
  { id: "individual", name: "Individual" },
];

// Default portfolio images
const defaultImages = [
  { id: "1", image_url: "https://images.unsplash.com/photo-1765447551791-b3581cce8207", title: "Maternity Elegance", category: "maternity", description: "Celebrating the beauty of motherhood" },
  { id: "2", image_url: "https://images.unsplash.com/photo-1644418657862-4ec86e44d6dc", title: "Peaceful Slumber", category: "newborn", description: "Capturing those precious first days" },
  { id: "3", image_url: "https://images.unsplash.com/photo-1761891950106-3276efeef9d1", title: "Little One", category: "newborn", description: "Tiny fingers, tiny toes" },
  { id: "4", image_url: "https://images.unsplash.com/photo-1760633549190-6f184e88d640", title: "Joy in Motion", category: "family", description: "Happiness captured in a moment" },
  { id: "5", image_url: "https://images.unsplash.com/photo-1761400306487-09e8dad8179f", title: "Golden Hour", category: "family", description: "Family love in golden light" },
  { id: "6", image_url: "https://images.unsplash.com/photo-1664837024902-5ace3976f806", title: "Artistic Portrait", category: "individual", description: "Timeless individual portrait" },
  { id: "7", image_url: "https://images.unsplash.com/photo-1601561956009-2537dfe81266", title: "Classic Portrait", category: "individual", description: "Simple elegance" },
  { id: "8", image_url: "https://images.unsplash.com/photo-1760633549204-f652cef723af", title: "Family Walk", category: "family", description: "Adventures together" },
];

const PortfolioPage = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [images, setImages] = useState([]);
  const [filteredImages, setFilteredImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  useEffect(() => {
    if (activeCategory === "all") {
      setFilteredImages(images);
    } else {
      setFilteredImages(images.filter((img) => img.category === activeCategory));
    }
  }, [activeCategory, images]);

  const fetchPortfolio = async () => {
    try {
      const res = await axios.get(`${API}/portfolio`);
      if (res.data.length > 0) {
        setImages(res.data);
      } else {
        setImages(defaultImages);
      }
    } catch (e) {
      setImages(defaultImages);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-warm-sand py-20 md:py-28" data-testid="portfolio-header">
        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
          <p className="text-primary font-medium tracking-widest uppercase text-sm mb-3">
            Portfolio
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6">
            Our Beautiful Work
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Browse through our collection of cherished moments. Each photograph tells a unique story
            of love, joy, and connection.
          </p>
        </div>
      </section>

      {/* Filter */}
      <section className="py-8 border-b border-border sticky top-20 bg-background/95 backdrop-blur-sm z-30">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center gap-4 overflow-x-auto pb-2">
            <Filter className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "ghost"}
                className={`rounded-full flex-shrink-0 ${
                  activeCategory === cat.id
                    ? "bg-primary text-white"
                    : "text-foreground/70 hover:text-foreground"
                }`}
                onClick={() => setActiveCategory(cat.id)}
                data-testid={`filter-${cat.id}`}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16 md:py-24" data-testid="portfolio-gallery">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {filteredImages.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No images found in this category.</p>
            </div>
          ) : (
            <div className="masonry-grid">
              {filteredImages.map((image, index) => (
                <div
                  key={image.id}
                  className="masonry-item"
                  data-testid={`portfolio-item-${index}`}
                >
                  <div
                    className="img-zoom rounded-xl overflow-hidden cursor-pointer shadow-soft card-hover"
                    onClick={() => setSelectedImage(image)}
                  >
                    <img
                      src={image.image_url}
                      alt={image.title}
                      className={`w-full object-cover ${
                        index % 3 === 0 ? "h-80" : index % 3 === 1 ? "h-96" : "h-72"
                      }`}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                      <div>
                        <p className="text-white font-semibold">{image.title}</p>
                        <p className="text-white/70 text-sm capitalize">{image.category}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
          data-testid="lightbox"
        >
          <div className="relative max-w-5xl w-full">
            <img
              src={selectedImage.image_url}
              alt={selectedImage.title}
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 rounded-b-lg">
              <p className="text-white font-display text-xl">{selectedImage.title}</p>
              {selectedImage.description && (
                <p className="text-white/70">{selectedImage.description}</p>
              )}
            </div>
            <button
              className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl"
              onClick={() => setSelectedImage(null)}
              data-testid="lightbox-close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioPage;
