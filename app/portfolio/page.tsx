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
      image_url:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg",
      featured: true,
      created_at: "2024-01-15",
      views: 15420,
      likes: 892,
      duration: "2:30",
    },
    {
      id: 2,
      title: "Wedding Photography",
      description: "Elegant wedding photography capturing precious moments and emotions.",
      category: "photography",
      image_url:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Battle%20of%20the%20brands%21%20We%20break%20down%20the%20pros%20and%E2%80%A6-Z3llZBagItsXwqfUoEPJQ21QkmfAQv.jpeg",
      featured: true,
      created_at: "2024-01-10",
      views: 8750,
      likes: 654,
      shots: 250,
    },
    {
      id: 3,
      title: "Modern Logo Design",
      description: "Clean and contemporary logo design for tech startup company.",
      category: "graphic-design",
      image_url:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unlock%20the%20power%20of%20stunning%20visuals%20with%20our%E2%80%A6-KCP9LosdezkL6slKvDC3Hb88AqngqZ.jpeg",
      featured: false,
      created_at: "2024-01-08",
      views: 5230,
      likes: 423,
      revisions: 3,
    },
    {
      id: 4,
      title: "Product Commercial",
      description: "High-end product commercial with cinematic lighting and effects.",
      category: "video-production",
      image_url:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg",
      featured: false,
      created_at: "2024-01-05",
      views: 12100,
      likes: 756,
      duration: "1:45",
    },
    {
      id: 5,
      title: "Portrait Session",
      description: "Professional portrait photography for business executives.",
      category: "photography",
      image_url:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Battle%20of%20the%20brands%21%20We%20break%20down%20the%20pros%20and%E2%80%A6-Z3llZBagItsXwqfUoEPJQ21QkmfAQv.jpeg",
      featured: false,
      created_at: "2024-01-03",
      views: 6890,
      likes: 445,
      shots: 120,
    },
    {
      id: 6,
      title: "Brand Identity Package",
      description: "Complete brand identity design including logo, colors, and typography.",
      category: "graphic-design",
      image_url:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unlock%20the%20power%20of%20stunning%20visuals%20with%20our%E2%80%A6-KCP9LosdezkL6slKvDC3Hb88AqngqZ.jpeg",
      featured: true,
      created_at: "2024-01-01",
      views: 9340,
      likes: 678,
      deliverables: 8,
    },
  ]
}

function PortfolioFilter({ items }: { items: any[] }) {
  const [activeFilter, setActiveFilter] = useState("all")

  const categories = ["all", ...new Set(items.map((item) => item.category))]

  const filteredItems = activeFilter === "all" ? items : items.filter((item) => item.category === activeFilter)

  const totalViews = items.reduce((sum, item) => sum + (item.views || 0), 0)
  const totalLikes = items.reduce((sum, item) => sum + (item.likes || 0), 0)
  const featuredCount = items.filter((item) => item.featured).length

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Total Views</h3>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
          <div className="text-3xl font-bold text-white mb-2">{totalViews.toLocaleString()}</div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
              style={{ width: "75%" }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Total Likes</h3>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-pulse"></div>
          </div>
          <div className="text-3xl font-bold text-white mb-2">{totalLikes.toLocaleString()}</div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className="bg-gradient-to-r from-pink-500 to-red-500 h-2 rounded-full" style={{ width: "68%" }}></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Featured Projects</h3>
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          <div className="text-3xl font-bold text-white mb-2">{featuredCount}</div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
              style={{ width: "90%" }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 mb-12">
        {categories.map((category) => (
          <Button
            key={category}
            variant={activeFilter === category ? "default" : "outline"}
            onClick={() => setActiveFilter(category)}
            className={`${
              activeFilter === category
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0"
                : "bg-slate-800 text-white border-slate-600 hover:bg-slate-700"
            } px-6 py-2 rounded-full transition-all duration-300`}
          >
            {category === "all" ? "All Work" : category.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredItems.map((item) => (
          <Card
            key={item.id}
            className="group overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300"
          >
            <div className="relative aspect-video overflow-hidden">
              <Image
                src={item.image_url || "/placeholder.svg"}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent group-hover:from-black/80 transition-all duration-300" />
              <div className="absolute top-4 left-4">
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium capitalize backdrop-blur-sm">
                  {item.category.replace("-", " ")}
                </span>
              </div>
              {item.featured && (
                <div className="absolute top-4 right-4">
                  <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                    ⭐ Featured
                  </span>
                </div>
              )}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center justify-between text-white text-sm">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">👁️ {item.views?.toLocaleString()}</span>
                    <span className="flex items-center gap-1">❤️ {item.likes}</span>
                  </div>
                  {item.duration && <span className="bg-black/50 px-2 py-1 rounded text-xs">{item.duration}</span>}
                </div>
              </div>
            </div>
            <CardContent className="p-6 bg-gradient-to-br from-slate-800 to-slate-900">
              <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-slate-300 mb-4">{item.description}</p>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4 text-slate-400">
                  {item.shots && <span>📸 {item.shots} shots</span>}
                  {item.revisions && <span>🔄 {item.revisions} revisions</span>}
                  {item.deliverables && <span>📦 {item.deliverables} files</span>}
                </div>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 hover:from-purple-700 hover:to-blue-700"
                >
                  View Details
                </Button>
              </div>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-slate-300">Loading portfolio...</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navigation />
      <section className="py-20 bg-gradient-to-br from-slate-900 via-purple-900/20 to-blue-900/20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10"></div>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          ></div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h1 className="text-5xl font-bold text-white mb-6">
            Creative
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              {" "}
              Portfolio
            </span>
          </h1>
          <p className="text-xl text-slate-300 leading-relaxed mb-8">
            Showcasing our finest work across multimedia content creation
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="text-3xl mb-2">📸</div>
              <h3 className="text-white font-semibold mb-1">Photography</h3>
              <p className="text-slate-400 text-sm">Professional shoots & portraits</p>
            </div>
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="text-3xl mb-2">🎬</div>
              <h3 className="text-white font-semibold mb-1">Videography</h3>
              <p className="text-slate-400 text-sm">Cinematic productions & commercials</p>
            </div>
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <div className="text-3xl mb-2">🎨</div>
              <h3 className="text-white font-semibold mb-1">Design</h3>
              <p className="text-slate-400 text-sm">Brand identity & visual graphics</p>
            </div>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PortfolioFilter items={portfolioItems} />
        </div>
      </section>
      <Footer />
    </div>
  )
}
