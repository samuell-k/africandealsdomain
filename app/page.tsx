import { supabase } from "@/lib/supabase/client"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

      <section className="relative bg-gradient-to-br from-purple-50 via-white to-blue-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full border border-purple-200 shadow-sm">
                <span className="text-sm font-medium text-purple-700">🎯 Professional Creative Studio</span>
              </div>

              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                Transform Ideas Into
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {" "}
                  Visual Stories
                </span>
              </h1>

              <p className="text-lg text-gray-600 leading-relaxed max-w-lg">
                Professional photography, videography, and design services that bring your vision to life with
                creativity and precision.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                  View Our Work
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="border-purple-300 text-purple-600 hover:bg-purple-50 bg-transparent"
                >
                  Get Quote
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6">
                <div className="bg-white rounded-xl p-4 shadow-md border border-purple-100 text-center">
                  <div className="text-2xl font-bold text-purple-600">500+</div>
                  <div className="text-sm text-gray-600">Projects Completed</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-md border border-blue-100 text-center">
                  <div className="text-2xl font-bold text-blue-600">98%</div>
                  <div className="text-sm text-gray-600">Client Satisfaction</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-md border border-purple-100 text-center">
                  <div className="text-2xl font-bold text-purple-600">5+</div>
                  <div className="text-sm text-gray-600">Years Experience</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg"
                  alt="Professional video editing workspace with concert footage"
                  width={600}
                  height={400}
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              <div className="absolute -top-4 -right-4 bg-white rounded-full p-3 shadow-lg border-4 border-purple-100">
                <Camera className="h-6 w-6 text-purple-600" />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-full p-3 shadow-lg border-4 border-blue-100">
                <Video className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-gray-900">My Creative Journey</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From passion to profession - building visual stories that matter
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 text-center border border-purple-200">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Photography Expert</h3>
              <p className="text-sm text-gray-600">
                Specializing in wedding, corporate, and product photography with 5+ years experience
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 text-center border border-blue-200">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Video Production</h3>
              <p className="text-sm text-gray-600">
                Creating compelling video content from concept to final edit for brands and events
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 text-center border border-green-200">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Palette className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Graphic Design</h3>
              <p className="text-sm text-gray-600">
                Crafting visual identities, logos, and marketing materials that make brands stand out
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 text-center border border-orange-200">
              <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Award Winner</h3>
              <p className="text-sm text-gray-600">
                Recognized for excellence in creative work with multiple industry awards and certifications
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-12">
            <h2 className="text-2xl font-bold text-gray-900">Our Services</h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              Professional multimedia solutions for every creative need
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow duration-300 overflow-hidden">
                <div className="relative h-32 overflow-hidden">
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
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20"></div>
                </div>
                <CardContent className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto">
                    {service.icon === "Camera" && <Camera className="h-6 w-6 text-purple-600" />}
                    {service.icon === "Video" && <Video className="h-6 w-6 text-purple-600" />}
                    {service.icon === "Palette" && <Palette className="h-6 w-6 text-purple-600" />}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{service.title}</h3>
                  <p className="text-gray-600 text-sm">{service.description}</p>
                  <p className="text-base font-medium text-purple-600">{service.price_range}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-12">
            <h2 className="text-2xl font-bold text-gray-900">Featured Projects</h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              Recent creative projects that showcase our expertise
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <div className="p-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-12">
            <h2 className="text-2xl font-bold text-gray-900">Client Testimonials</h2>
            <p className="text-base text-gray-600">What our clients say about working with us</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.id} className="p-6">
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <blockquote className="text-gray-700 text-sm leading-relaxed">"{testimonial.testimonial}"</blockquote>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="font-medium text-purple-600 text-sm">{testimonial.client_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{testimonial.client_name}</p>
                      <p className="text-purple-600 text-xs">{testimonial.client_company}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">Ready to Start Your Project?</h2>
          <p className="text-base text-purple-100 mb-6 max-w-2xl mx-auto">
            Let's work together to create something amazing that tells your story
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/contact">
              <Button className="bg-white text-purple-600 hover:bg-gray-100">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/portfolio">
              <Button
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-purple-600 bg-transparent"
              >
                View Portfolio
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
