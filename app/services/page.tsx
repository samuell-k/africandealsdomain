import { createClient } from "@/lib/supabase/server"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Camera, Video, Palette, Package, Calendar, Check } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

function getFallbackServices() {
  return [
    {
      id: 1,
      title: "Wedding Photography",
      description: "Capture your special day with stunning, timeless photographs that tell your unique love story.",
      price_range: "Starting at $2,500",
      icon: "Camera",
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      title: "Corporate Videography",
      description: "Professional video production for corporate events, training materials, and promotional content.",
      price_range: "Starting at $3,000",
      icon: "Video",
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      title: "Brand Design",
      description: "Complete brand identity design including logos, color schemes, and marketing materials.",
      price_range: "Starting at $1,500",
      icon: "Palette",
      created_at: new Date().toISOString(),
    },
    {
      id: 4,
      title: "Event Photography",
      description: "Professional event coverage for conferences, parties, and special occasions.",
      price_range: "Starting at $800",
      icon: "Camera",
      created_at: new Date().toISOString(),
    },
    {
      id: 5,
      title: "Product Photography",
      description: "High-quality product shots for e-commerce, catalogs, and marketing materials.",
      price_range: "Starting at $500",
      icon: "Package",
      created_at: new Date().toISOString(),
    },
    {
      id: 6,
      title: "Social Media Content",
      description: "Engaging visual content creation for social media platforms and digital marketing.",
      price_range: "Starting at $1,200",
      icon: "Calendar",
      created_at: new Date().toISOString(),
    },
  ]
}

async function getServices() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from("services").select("*").order("created_at", { ascending: true })

    if (error) {
      console.log("Database error, using fallback services data:", error.message)
      return getFallbackServices()
    }

    return data || []
  } catch (error) {
    console.log("Error fetching services, using fallback data:", error)
    return getFallbackServices()
  }
}

export default async function ServicesPage() {
  const services = await getServices()

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Camera":
        return Camera
      case "Video":
        return Video
      case "Palette":
        return Palette
      case "Package":
        return Package
      case "Calendar":
        return Calendar
      default:
        return Camera
    }
  }

  const serviceFeatures = {
    "Wedding Photography": [
      "Full day coverage (8-10 hours)",
      "Engagement session included",
      "Online gallery with download rights",
      "Professional editing and retouching",
      "500+ high-resolution images",
      "USB drive with all photos",
    ],
    "Corporate Videography": [
      "Pre-production planning",
      "Professional equipment and crew",
      "Multiple camera angles",
      "Professional editing and color grading",
      "Music and sound design",
      "Multiple format delivery",
    ],
    "Brand Design": [
      "Logo design concepts",
      "Brand guidelines document",
      "Color palette and typography",
      "Business card design",
      "Letterhead and envelope design",
      "Social media templates",
    ],
    "Event Photography": [
      "Professional event coverage",
      "Multiple camera angles",
      "High-resolution images",
      "Quick turnaround time",
      "Customized event packages",
      "Print and digital formats available",
    ],
    "Product Photography": [
      "High-quality product shots",
      "Stylish and professional editing",
      "Multiple angles and lighting options",
      "Background removal services",
      "Print and digital formats available",
      "SEO-friendly image optimization",
    ],
    "Social Media Content": [
      "Engaging visual content creation",
      "Tailored to your brand and audience",
      "Regular posting schedule",
      "Analytics and reporting",
      "Creative concept development",
      "Collaborative content creation process",
    ],
  }

  const getServiceImage = (title: string) => {
    switch (title) {
      case "Wedding Photography":
      case "Event Photography":
        return "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Battle%20of%20the%20brands%21%20We%20break%20down%20the%20pros%20and%E2%80%A6-Z3llZBagItsXwqfUoEPJQ21QkmfAQv.jpeg" // Canon camera image for photography services
      case "Corporate Videography":
      case "Social Media Content":
        return "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg" // Video editing workspace for video services
      case "Brand Design":
      case "Product Photography":
        return "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unlock%20the%20power%20of%20stunning%20visuals%20with%20our%E2%80%A6-KCP9LosdezkL6slKvDC3Hb88AqngqZ.jpeg" // Graphic design poster for design services
      default:
        return "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Battle%20of%20the%20brands%21%20We%20break%20down%20the%20pros%20and%E2%80%A6-Z3llZBagItsXwqfUoEPJQ21QkmfAQv.jpeg"
    }
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />

      {/* Hero Section with Video Background */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-blue-900/90 to-gray-900/90" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-4xl font-bold text-white leading-tight">
                Professional
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                  {" "}
                  Multimedia Services
                </span>
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed">
                Cutting-edge creative solutions powered by advanced technology and artistic vision
              </p>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-purple-800/50 to-blue-800/50 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
                  <div className="text-2xl font-bold text-white">500+</div>
                  <div className="text-sm text-gray-300">Projects Completed</div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full w-4/5"></div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-800/50 to-purple-800/50 backdrop-blur-sm rounded-xl p-4 border border-blue-500/20">
                  <div className="text-2xl font-bold text-white">98%</div>
                  <div className="text-sm text-gray-300">Client Satisfaction</div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full w-full"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-purple-800/30 to-blue-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg"
                  alt="Professional multimedia equipment and studio setup"
                  width={400}
                  height={300}
                  className="rounded-xl shadow-2xl"
                />
                <div className="absolute -top-4 -right-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full p-3">
                  <Video className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid with Modern Dark Cards */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold text-white">Our Services</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Professional multimedia solutions with cutting-edge technology
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => {
              const IconComponent = getIcon(service.icon)
              const features = serviceFeatures[service.title as keyof typeof serviceFeatures] || []

              return (
                <div key={service.id} className="group">
                  <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105">
                    {/* Service Image */}
                    <div className="relative h-32 overflow-hidden rounded-xl mb-6">
                      <Image
                        src={getServiceImage(service.title) || "/placeholder.svg"}
                        alt={`${service.title} service`}
                        width={250}
                        height={128}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute top-3 right-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full p-2">
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>
                    </div>

                    {/* Service Content */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-white">{service.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{service.description}</p>

                      {/* Price with Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                            {service.price_range}
                          </span>
                          <span className="text-xs text-gray-500">Popular</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1">
                          <div
                            className={`bg-gradient-to-r from-purple-500 to-blue-500 h-1 rounded-full`}
                            style={{ width: `${60 + index * 10}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Features */}
                      {features.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-300 text-sm">Includes:</h4>
                          <ul className="space-y-1">
                            {features.slice(0, 3).map((feature, idx) => (
                              <li key={idx} className="flex items-center space-x-2 text-xs text-gray-400">
                                <Check className="h-3 w-3 text-green-400 flex-shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Link href="/contact">
                        <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0">
                          Get Quote
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Technology Stack Cards */}
      <section className="py-20 bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold text-white">Our Technology</h2>
            <p className="text-gray-400">Professional equipment and software we use</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: "Canon R5", type: "Camera", usage: "95%" },
              { name: "Adobe Premiere", type: "Editing", usage: "90%" },
              { name: "DJI Ronin", type: "Stabilizer", usage: "85%" },
              { name: "Photoshop", type: "Design", usage: "98%" },
            ].map((tech, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50"
              >
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{tech.name}</div>
                    <div className="text-gray-400 text-xs">{tech.type}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="w-full bg-gray-700 rounded-full h-1">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-blue-500 h-1 rounded-full"
                        style={{ width: tech.usage }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500">{tech.usage} Usage</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section with Modern Cards */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold text-white">Our Process</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Streamlined workflow for exceptional results</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Consultation",
                description: "Vision & requirements discussion",
                color: "from-purple-500 to-pink-500",
              },
              {
                step: "02",
                title: "Planning",
                description: "Detailed project timeline",
                color: "from-blue-500 to-cyan-500",
              },
              {
                step: "03",
                title: "Creation",
                description: "Professional execution",
                color: "from-green-500 to-teal-500",
              },
              {
                step: "04",
                title: "Delivery",
                description: "Final delivery & support",
                color: "from-orange-500 to-red-500",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 text-center space-y-4"
              >
                <div
                  className={`w-16 h-16 bg-gradient-to-r ${item.color} rounded-full flex items-center justify-center mx-auto`}
                >
                  <span className="text-white font-bold text-lg">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.description}</p>
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div
                    className={`bg-gradient-to-r ${item.color} h-1 rounded-full`}
                    style={{ width: `${25 * (index + 1)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-900 to-blue-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to Create Something Amazing?</h2>
          <p className="text-lg text-purple-200 mb-8">
            Let's bring your vision to life with our professional multimedia services
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100">
                Start Your Project
              </Button>
            </Link>
            <Link href="/portfolio">
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-purple-600 bg-transparent"
              >
                View Our Work
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
