import { supabase } from "@/lib/supabase/client"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Camera, Video, Palette, Star, ArrowRight } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

async function getFeaturedContent() {
  try {
    const [portfolioResult, servicesResult, testimonialsResult] = await Promise.all([
      supabase.from("portfolio_items").select("*").eq("featured", true).limit(3),
      supabase.from("services").select("*").eq("featured", true).limit(3),
      supabase.from("testimonials").select("*").eq("featured", true).limit(2),
    ])

    return {
      portfolio: portfolioResult.data || [],
      services: servicesResult.data || [],
      testimonials: testimonialsResult.data || [],
    }
  } catch (error) {
    return {
      portfolio: [
        {
          id: 1,
          title: "Corporate Brand Video",
          description: "Dynamic brand storytelling for tech startup",
          category: "video-production",
          image_url: "/placeholder.svg?height=400&width=600",
          featured: true,
        },
        {
          id: 2,
          title: "Product Photography",
          description: "High-end product shots for e-commerce",
          category: "photography",
          image_url: "/placeholder.svg?height=400&width=600",
          featured: true,
        },
        {
          id: 3,
          title: "Brand Identity Design",
          description: "Complete visual identity for luxury brand",
          category: "graphic-design",
          image_url: "/placeholder.svg?height=400&width=600",
          featured: true,
        },
      ],
      services: [
        {
          id: 1,
          title: "Video Production",
          description: "Professional video content from concept to completion",
          icon: "Video",
          price_range: "Starting at $2,500",
          featured: true,
        },
        {
          id: 2,
          title: "Photography",
          description: "Stunning photography for all your visual needs",
          icon: "Camera",
          price_range: "Starting at $500",
          featured: true,
        },
        {
          id: 3,
          title: "Graphic Design",
          description: "Creative design solutions that make an impact",
          icon: "Palette",
          price_range: "Starting at $300",
          featured: true,
        },
      ],
      testimonials: [
        {
          id: 1,
          client_name: "Sarah Johnson",
          client_company: "TechFlow Inc.",
          testimonial:
            "Absolutely incredible work! The team delivered beyond our expectations and the final video perfectly captured our brand essence.",
          rating: 5,
          featured: true,
        },
        {
          id: 2,
          client_name: "Michael Chen",
          client_company: "Luxury Brands Co.",
          testimonial:
            "Professional, creative, and reliable. Their photography work elevated our product catalog to a whole new level.",
          rating: 5,
          featured: true,
        },
      ],
    }
  }
}

export default async function HomePage() {
  const { portfolio, services, testimonials } = await getFeaturedContent()

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <section className="relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video autoPlay loop muted playsInline className="w-full h-full object-cover">
            <source
              src="/placeholder.mp4?query=professional video editing workspace with multiple monitors showing creative content"
              type="video/mp4"
            />
          </video>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/70 to-slate-900/80"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Left Analytics Card - Made smaller */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Camera className="h-4 w-4 text-white" />
                </div>
                <span className="text-cyan-400 font-medium text-sm">Smart Analytics</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-md flex items-center justify-center">
                      <Video className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 bg-slate-700 rounded-full h-1.5 w-16">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full w-4/5"></div>
                    </div>
                  </div>
                  <Star className="h-3 w-3 text-yellow-400 fill-current" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-md flex items-center justify-center">
                      <Palette className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 bg-slate-700 rounded-full h-1.5 w-16">
                      <div className="bg-gradient-to-r from-green-500 to-cyan-500 h-1.5 rounded-full w-3/5"></div>
                    </div>
                  </div>
                  <Star className="h-3 w-3 text-yellow-400 fill-current" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-md flex items-center justify-center">
                      <Camera className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 bg-slate-700 rounded-full h-1.5 w-16">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full w-5/6"></div>
                    </div>
                  </div>
                  <Star className="h-3 w-3 text-yellow-400 fill-current" />
                </div>
              </div>
            </div>

            {/* Center Content - Made more compact */}
            <div className="space-y-4 text-center lg:text-left">
              <div className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-600/80 to-blue-600/80 rounded-full border border-purple-400/50 shadow-sm backdrop-blur-sm">
                <span className="text-xs font-medium text-white">🎯 Professional Creative Studio</span>
              </div>

              <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
                Find me the
                <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">
                  {" "}
                  best creative solutions
                </span>
                <br />
                for
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  {" "}
                  your brand's future
                </span>
                <br />
                that offers
                <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  {" "}
                  quality content
                </span>{" "}
                and
                <br />
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  multimedia opportunities
                </span>
              </h1>

              <p className="text-slate-300 text-sm leading-relaxed max-w-lg mx-auto lg:mx-0">
                AI-powered creative solutions for modern brands and businesses
              </p>

              <Button className="bg-white text-slate-900 hover:bg-slate-100 shadow-lg hover:shadow-xl transition-all duration-200 rounded-full px-6 py-2">
                <span className="text-slate-900 font-semibold text-sm">Start Your Journey</span>
                <ArrowRight className="ml-2 h-3 w-3 text-slate-900" />
              </Button>
            </div>

            {/* Right Equipment Card - Made smaller */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Video className="h-4 w-4 text-white" />
                </div>
                <span className="text-purple-400 font-medium text-sm">Pro Equipment</span>
              </div>

              <div className="relative rounded-lg overflow-hidden mb-3">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Battle%20of%20the%20brands%21%20We%20break%20down%20the%20pros%20and%E2%80%A6-Z3llZBagItsXwqfUoEPJQ21QkmfAQv.jpeg"
                  alt="Professional camera equipment"
                  width={300}
                  height={120}
                  className="w-full h-20 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-md p-1.5 border border-red-500/30">
                  <div className="w-4 h-4 bg-red-500 rounded-sm mx-auto"></div>
                </div>
                <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-md p-1.5 border border-pink-500/30">
                  <div className="w-4 h-4 bg-pink-500 rounded-sm mx-auto"></div>
                </div>
                <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-md p-1.5 border border-cyan-500/30">
                  <div className="w-4 h-4 bg-cyan-500 rounded-sm mx-auto"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl font-bold text-white">Connect With Us</h2>
            <p className="text-sm text-slate-400">Follow our creative journey across platforms</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Instagram Card */}
            <div className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 backdrop-blur-sm rounded-xl p-4 border border-pink-500/30 hover:border-pink-400/50 transition-all duration-300 group cursor-pointer">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="h-5 w-5 text-white" />
                </div>
                <span className="text-white text-xs font-medium">Instagram</span>
                <div className="w-full bg-slate-700 rounded-full h-1">
                  <div className="bg-gradient-to-r from-pink-500 to-purple-500 h-1 rounded-full w-4/5"></div>
                </div>
              </div>
            </div>

            {/* YouTube Card */}
            <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-sm rounded-xl p-4 border border-red-500/30 hover:border-red-400/50 transition-all duration-300 group cursor-pointer">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Video className="h-5 w-5 text-white" />
                </div>
                <span className="text-white text-xs font-medium">YouTube</span>
                <div className="w-full bg-slate-700 rounded-full h-1">
                  <div className="bg-gradient-to-r from-red-500 to-orange-500 h-1 rounded-full w-3/4"></div>
                </div>
              </div>
            </div>

            {/* Facebook Card */}
            <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm rounded-xl p-4 border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 group cursor-pointer">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Palette className="h-5 w-5 text-white" />
                </div>
                <span className="text-white text-xs font-medium">Facebook</span>
                <div className="w-full bg-slate-700 rounded-full h-1">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1 rounded-full w-5/6"></div>
                </div>
              </div>
            </div>

            {/* Twitter Card */}
            <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-sm rounded-xl p-4 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-300 group cursor-pointer">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Star className="h-5 w-5 text-white" />
                </div>
                <span className="text-white text-xs font-medium">Twitter</span>
                <div className="w-full bg-slate-700 rounded-full h-1">
                  <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1 rounded-full w-2/3"></div>
                </div>
              </div>
            </div>

            {/* LinkedIn Card */}
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 backdrop-blur-sm rounded-xl p-4 border border-blue-600/30 hover:border-blue-500/50 transition-all duration-300 group cursor-pointer">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ArrowRight className="h-5 w-5 text-white" />
                </div>
                <span className="text-white text-xs font-medium">LinkedIn</span>
                <div className="w-full bg-slate-700 rounded-full h-1">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 h-1 rounded-full w-3/5"></div>
                </div>
              </div>
            </div>

            {/* TikTok Card */}
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 group cursor-pointer">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Video className="h-5 w-5 text-white" />
                </div>
                <span className="text-white text-xs font-medium">TikTok</span>
                <div className="w-full bg-slate-700 rounded-full h-1">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full w-4/6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl font-bold text-white">Professional Services</h2>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto">
              Advanced multimedia solutions powered by cutting-edge technology
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {services.map((service, index) => (
              <div
                key={service.id}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 group"
              >
                <div className="relative h-24 rounded-lg overflow-hidden mb-4">
                  <Image
                    src={
                      service.icon === "Camera"
                        ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Battle%20of%20the%20brands%21%20We%20break%20down%20the%20pros%20and%E2%80%A6-Z3llZBagItsXwqfUoEPJQ21QkmfAQv.jpeg"
                        : service.icon === "Video"
                          ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg"
                          : "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unlock%20the%20power%20of%20stunning%20visuals%20with%20our%E2%80%A6-KCP9LosdezkL6slKvDC3Hb88AqngqZ.jpeg"
                    }
                    alt={`${service.title} service`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                  <div className="absolute top-2 left-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        service.icon === "Camera"
                          ? "bg-gradient-to-r from-blue-500 to-cyan-500"
                          : service.icon === "Video"
                            ? "bg-gradient-to-r from-purple-500 to-pink-500"
                            : "bg-gradient-to-r from-green-500 to-emerald-500"
                      }`}
                    >
                      {service.icon === "Camera" && <Camera className="h-4 w-4 text-white" />}
                      {service.icon === "Video" && <Video className="h-4 w-4 text-white" />}
                      {service.icon === "Palette" && <Palette className="h-4 w-4 text-white" />}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">{service.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{service.description}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {service.price_range}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </div>

                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        service.icon === "Camera"
                          ? "bg-gradient-to-r from-blue-500 to-cyan-500 w-4/5"
                          : service.icon === "Video"
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 w-5/6"
                            : "bg-gradient-to-r from-green-500 to-emerald-500 w-3/4"
                      }`}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-xl font-bold text-gray-900">My Creative Journey</h2>
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              From passion to profession - building visual stories that matter
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center border border-purple-200">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">Photography Expert</h3>
              <p className="text-xs text-gray-600">
                Specializing in wedding, corporate, and product photography with 5+ years experience
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center border border-blue-200">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Video className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">Video Production</h3>
              <p className="text-xs text-gray-600">
                Creating compelling video content from concept to final edit for brands and events
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center border border-green-200">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Palette className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">Graphic Design</h3>
              <p className="text-xs text-gray-600">
                Crafting visual identities, logos, and marketing materials that make brands stand out
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 text-center border border-orange-200">
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Star className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">Award Winner</h3>
              <p className="text-xs text-gray-600">
                Recognized for excellence in creative work with multiple industry awards and certifications
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-xl font-bold text-gray-900">Featured Projects</h2>
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              Recent creative projects that showcase our expertise
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {portfolio.map((item, index) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={
                      item.category === "video-production"
                        ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg"
                        : item.category === "photography"
                          ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Battle%20of%20the%20brands%21%20We%20break%20down%20the%20pros%20and%E2%80%A6-Z3llZBagItsXwqfUoEPJQ21QkmfAQv.jpeg"
                          : "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unlock%20the%20power%20of%20stunning%20visuals%20with%20our%E2%80%A6-KCP9LosdezkL6slKvDC3Hb88AqngqZ.jpeg"
                    }
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <span className="bg-white/90 text-gray-900 px-2 py-1 rounded text-xs font-medium capitalize">
                      {item.category.replace("-", " ")}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-600 text-xs">{item.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-xl font-bold text-white">Client Success Stories</h2>
            <p className="text-sm text-slate-400">Real results from our creative partnerships</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-0.5">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                </div>

                <blockquote className="text-slate-300 text-xs leading-relaxed mb-3">
                  "{testimonial.testimonial}"
                </blockquote>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <span className="font-medium text-white text-xs">{testimonial.client_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-white text-xs">{testimonial.client_name}</p>
                      <p className="text-purple-400 text-xs">{testimonial.client_company}</p>
                    </div>
                  </div>

                  <div className="w-full max-w-16 bg-slate-700 rounded-full h-1 ml-3">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full w-4/5"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-xl lg:text-2xl font-bold text-white mb-3">Ready to Start Your Project?</h2>
          <p className="text-sm text-purple-100 mb-4 max-w-2xl mx-auto">
            Let's work together to create something amazing that tells your story
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link href="/contact">
              <Button className="bg-white text-purple-600 hover:bg-gray-100 px-6 py-2">
                <span className="text-purple-600 text-sm">Get Started</span>
                <ArrowRight className="ml-2 h-3 w-3 text-purple-600" />
              </Button>
            </Link>
            <Link href="/portfolio">
              <Button className="bg-purple-800 text-white hover:bg-purple-900 border-0 px-6 py-2">
                <span className="text-white text-sm">View Portfolio</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
