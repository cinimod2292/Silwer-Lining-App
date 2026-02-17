import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const categories = [
  { id: "all", name: "All" },
  { id: "maternity", name: "Maternity" },
  { id: "newborn", name: "Newborn" },
  { id: "family", name: "Family & Mommy Me" },
  { id: "baby-birthday", name: "Baby Birthday" },
  { id: "adult-birthday", name: "Adult Birthday" },
  { id: "brand-product", name: "Brand/Product" },
];

// Real portfolio images from silwerlining.co.za
const defaultImages = [
  // Maternity
  { id: "mat1", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/_DSC6768-62b28956-1000.jpg", title: "Couple Maternity", category: "maternity" },
  { id: "mat2", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/_DSC6949-31c04db5-1000.jpg", title: "Elegant Maternity", category: "maternity" },
  { id: "mat3", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/_DSC5179-f7cbe338-1000.jpg", title: "White Fabric Maternity", category: "maternity" },
  { id: "mat4", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/_DSC5091-057c61cb-1000.jpg", title: "Gold Gown Maternity", category: "maternity" },
  { id: "mat5", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/_DSC0963-ce201870-1000.jpg", title: "Intimate Couple", category: "maternity" },
  { id: "mat6", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/_DSC9230-Recovered-104d85c5-1000.jpg", title: "Studio Couple", category: "maternity" },
  { id: "mat7", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/_DSC7829-22f01b4f-1000.jpg", title: "Silhouette Couple", category: "maternity" },
  { id: "mat8", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/JasmineSneakpeek3-bc3b54d6-1000.jpg", title: "White Fabric", category: "maternity" },
  { id: "mat9", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/KERILENG3-33444db6-1000.jpg", title: "Pearl Accessory", category: "maternity" },
  { id: "mat10", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/KERILENG51-c1f3cf45-1000.jpg", title: "Artistic Portrait", category: "maternity" },
  { id: "mat11", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/_DSC3620_3-4d8bbd04-1000.jpg", title: "Pink Dream", category: "maternity" },
  { id: "mat12", image_url: "https://images-pw.pixieset.com/elementfield/qyn5qab/_DSC10772-8a404e3f-1000.jpg", title: "Golden Hour", category: "maternity" },
  
  // Newborn
  { id: "new1", image_url: "https://images-pw.pixieset.com/elementfield/yWK5leJ/_DSC2224_1-5d48c4c9-1000.jpg", title: "Peaceful Sleep", category: "newborn" },
  { id: "new2", image_url: "https://images-pw.pixieset.com/elementfield/yWK5leJ/_DSC2182-afff463a-1000.jpg", title: "Basket Portrait", category: "newborn" },
  { id: "new3", image_url: "https://images-pw.pixieset.com/elementfield/yWK5leJ/AKWE24-02830378-1000.jpg", title: "Lace Dress", category: "newborn" },
  { id: "new4", image_url: "https://images-pw.pixieset.com/elementfield/yWK5leJ/AKWE12-a3464568-1000.jpg", title: "Purple Tulle", category: "newborn" },
  { id: "new5", image_url: "https://images-pw.pixieset.com/elementfield/yWK5leJ/AKWE25-51f1c79b-1000.jpg", title: "Cream Lace Wrap", category: "newborn" },
  { id: "new6", image_url: "https://images-pw.pixieset.com/elementfield/yWK5leJ/AKWE27-e1cdc848-1000.jpg", title: "Wicker Chair", category: "newborn" },
  { id: "new7", image_url: "https://images-pw.pixieset.com/elementfield/yWK5leJ/AKWE36-137a4abb-1000.jpg", title: "Family Portrait", category: "newborn" },
  { id: "new8", image_url: "https://images-pw.pixieset.com/elementfield/yWK5leJ/_DSC8203-Recovered-f0126ceb-1000.jpg", title: "Butterfly Dreams", category: "newborn" },
  { id: "new9", image_url: "https://images-pw.pixieset.com/elementfield/yWK5leJ/_DSC8278-Recovered-a360a808-1000.jpg", title: "Cozy Basket", category: "newborn" },
  { id: "new10", image_url: "https://images-pw.pixieset.com/elementfield/yWK5leJ/_DSC7167-101ab1b6-1000.jpg", title: "Sweet Dreams", category: "newborn" },
  
  // Family
  { id: "fam1", image_url: "https://images-pw.pixieset.com/site/Nzv0dL/Ayr5KK/MONGALEFAMILYPHOTOS6-e9c3fdd0-1500.jpg", title: "Family Portrait", category: "family" },
  { id: "fam2", image_url: "https://images-pw.pixieset.com/elementfield/170321823/PORTELLI1-2c5a22f1-1500.jpg", title: "Garden Family", category: "family" },
  { id: "fam3", image_url: "https://images-pw.pixieset.com/site/Nzv0dL/7p3e9q/J-981123c4-1500.jpg", title: "Mommy & Me", category: "family" },
  { id: "fam4", image_url: "https://images-pw.pixieset.com/elementfield/777916812/PORTELLI123-7e8b1649-1500.jpg", title: "Sunset Portrait", category: "family" },
  
  // Baby Birthday
  { id: "bb1", image_url: "https://images-pw.pixieset.com/site/Nzv0dL/WDdooa/SILWERLININGPHOTOGRAPHY-LUMI50-591942a0-1500.jpg", title: "Balloon Fun", category: "baby-birthday" },
  { id: "bb2", image_url: "https://images-pw.pixieset.com/elementfield/204211912/3-ddd5aa05.JPG", title: "Safari Theme", category: "baby-birthday" },
  
  // Adult Birthday
  { id: "ab1", image_url: "https://images-pw.pixieset.com/site/Nzv0dL/WomqQY/_DSC7012-34e9895c-1500.jpg", title: "Celebration", category: "adult-birthday" },
  
  // Brand/Product
  { id: "bp1", image_url: "https://images-pw.pixieset.com/site/Nzv0dL/70GxyA/_DSC6154-17ae8b12-1500.jpg", title: "Product Shot", category: "brand-product" },
];

const PortfolioPage = () => {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [images, setImages] = useState([]);
  const [filteredImages, setFilteredImages] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const selectedImage = selectedIndex !== null ? filteredImages[selectedIndex] : null;

  const goToNext = useCallback(() => {
    if (selectedIndex !== null && selectedIndex < filteredImages.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  }, [selectedIndex, filteredImages.length]);

  const goToPrev = useCallback(() => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  }, [selectedIndex]);

  const closeLightbox = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedIndex === null) return;
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, goToNext, goToPrev, closeLightbox]);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  useEffect(() => {
    const category = searchParams.get("category");
    if (category) {
      setActiveCategory(category);
    }
  }, [searchParams]);

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
                    className="img-zoom rounded-xl overflow-hidden cursor-pointer shadow-soft card-hover relative"
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
                        <p className="text-white/70 text-sm capitalize">{image.category?.replace('-', ' ')}</p>
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
