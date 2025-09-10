import { supabase } from "@/lib/supabase/client"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Camera, Video, Palette, Package, Calendar, Check } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

async function getServices() {
  try {
    const { data, error } = await supabase.from("services").select("*").order("created_at", { ascending: true })

    if (error) {
      if (error.message.includes("Could not find the table")) {
        console.log("Database tables not found, using fallback services data")
        return [
          {
            id: 1,
            title: "Wedding Photography",
            description:
              "Capture your special day with stunning, timeless photographs that tell your unique love story.",
            price_range: "Starting at $2,500",
            icon: "Camera",
            created_at: new Date().toISOString(),
          },
          {
            id: 2,
            title: "Corporate Videography",
            description:
              "Professional video production for corporate events, training materials, and promotional content.",
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
      console.error("Error fetching services:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Error fetching services:", error)
    return []
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
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl font-bold text-gray-900 leading-tight">
                Our
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                  {" "}
                  Services
                </span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Professional multimedia solutions tailored to your unique needs and vision
              </p>
            </div>
            <div className="relative">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg" // Using video editing workspace image
                alt="Professional multimedia equipment and studio setup"
                width={400} // Made smaller from 600
                height={300} // Made smaller from 500
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service) => {
              const IconComponent = getIcon(service.icon)
              const features = serviceFeatures[service.title as keyof typeof serviceFeatures] || []

              return (
                <Card key={service.id} className="group hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                  <div className="relative h-40 overflow-hidden">
                    {" "}
                    {/* Made smaller from h-48 */}
                    <Image
                      src={
                        getServiceImage(service.title) ||
                        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Battle%20of%20the%20brands%21%20We%20break%20down%20the%20pros%20and%E2%80%A6-Z3llZBagItsXwqfUoEPJQ21QkmfAQv.jpeg"
                      }
                      alt={`${service.title} service`}
                      width={250} // Made smaller from 300
                      height={160} // Made smaller from 200
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>

                  <CardContent className="p-8 space-y-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <IconComponent className="h-8 w-8 text-purple-600" />
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-2xl font-semibold text-gray-900">{service.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{service.description}</p>
                      <p className="text-2xl font-bold text-purple-600">{service.price_range}</p>
                    </div>

                    {features.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900">What's Included:</h4>
                        <ul className="space-y-2">
                          {features.slice(0, 4).map((feature, index) => (
                            <li key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Link href="/contact">
                      <Button className="w-full bg-purple-600 hover:bg-purple-700">Get Quote</Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-gray-900">Our Process</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A streamlined approach to delivering exceptional results
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Consultation", description: "We discuss your vision, goals, and requirements" },
              { step: "02", title: "Planning", description: "Detailed project planning and timeline creation" },
              { step: "03", title: "Creation", description: "Professional execution of your multimedia project" },
              { step: "04", title: "Delivery", description: "Final delivery with revisions and support" },
            ].map((item, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-white font-bold text-lg">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-purple-100 mb-8">
            Let's discuss your project and create something amazing together
          </p>
          <Link href="/contact">
            <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100">
              Contact Us Today
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
