"use client"

import { supabase } from "@/lib/supabase/client"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import { useState, useEffect } from "react"

function getFallbackPortfolioItems() {
  return [
    {
      id: 1,
      title: "Corporate Brand Video",
      description: "A dynamic brand video showcasing modern corporate identity and values.",
      category: "video-production",
      image_url: "/placeholder.svg?height=400&width=600",
      featured: true,
      created_at: "2024-01-15",
    },
    {
      id: 2,
      title: "Wedding Photography",
      description: "Elegant wedding photography capturing precious moments and emotions.",
      category: "photography",
      image_url: "/placeholder.svg?height=400&width=600",
      featured: true,
      created_at: "2024-01-10",
    },
    {
      id: 3,
      title: "Modern Logo Design",
      description: "Clean and contemporary logo design for tech startup company.",
      category: "graphic-design",
      image_url: "/placeholder.svg?height=400&width=600",
      featured: false,
      created_at: "2024-01-08",
    },
    {
      id: 4,
      title: "Product Commercial",
      description: "High-end product commercial with cinematic lighting and effects.",
      category: "video-production",
      image_url: "/placeholder.svg?height=400&width=600",
      featured: false,
      created_at: "2024-01-05",
    },
    {
      id: 5,
      title: "Portrait Session",
      description: "Professional portrait photography for business executives.",
      category: "photography",
      image_url: "/placeholder.svg?height=400&width=600",
      featured: false,
      created_at: "2024-01-03",
    },
    {
      id: 6,
      title: "Brand Identity Package",
      description: "Complete brand identity design including logo, colors, and typography.",
      category: "graphic-design",
      image_url: "/placeholder.svg?height=400&width=600",
      featured: true,
      created_at: "2024-01-01",
    },
  ]
}

function PortfolioFilter({ items }: { items: any[] }) {
  const [activeFilter, setActiveFilter] = useState("all")

  const categories = ["all", ...new Set(items.map((item) => item.category))]

  const filteredItems = activeFilter === "all" ? items : items.filter((item) => item.category === activeFilter)

  return (
    <>
      {/* Filter Buttons */}
      <div className="flex flex-wrap justify-center gap-4 mb-12">
        {categories.map((category) => (
          <Button
            key={category}
            variant={activeFilter === category ? "default" : "outline"}
            onClick={() => setActiveFilter(category)}
            className={activeFilter === category ? "bg-purple-600 hover:bg-purple-700" : ""}
          >
            {category === "all" ? "All Work" : category.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </Button>
        ))}
      </div>

      {/* Portfolio Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredItems.map((item) => (
          <Card key={item.id} className="group overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="relative aspect-video overflow-hidden">
              <Image
                src={item.image_url || "/placeholder.svg"}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
              <div className="absolute top-4 left-4">
                <span className="bg-white/90 text-gray-900 px-3 py-1 rounded-full text-sm font-medium capitalize">
                  {item.category.replace("-", " ")}
                </span>
              </div>
              {item.featured && (
                <div className="absolute top-4 right-4">
                  <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium">Featured</span>
                </div>
              )}
            </div>
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

export default function PortfolioPage() {
  const [portfolioItems, setPortfolioItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPortfolioItems() {
      try {
        const { data, error } = await supabase
          .from("portfolio_items")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          console.log("Database error, using fallback data:", error.message)
          setPortfolioItems(getFallbackPortfolioItems())
        } else {
          setPortfolioItems(data || getFallbackPortfolioItems())
        }
      } catch (error: any) {
        console.log("Connection error, using fallback data:", error.message)
        setPortfolioItems(getFallbackPortfolioItems())
      } finally {
        setLoading(false)
      }
    }

    fetchPortfolioItems()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading portfolio...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Our
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
              {" "}
              Portfolio
            </span>
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            A showcase of our creative work across photography, videography, and graphic design
          </p>
        </div>
      </section>

      {/* Portfolio Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PortfolioFilter items={portfolioItems} />
        </div>
      </section>

      <Footer />
    </div>
  )
}
