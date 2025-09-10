import { createClient } from "@/lib/supabase/server"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Star, Quote, Camera, Video, Palette, TrendingUp, Users, Award, Heart, MessageCircle } from "lucide-react"

async function getTestimonials() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from("testimonials").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching testimonials:", error)
      return [
        {
          id: 1,
          client_name: "Sarah Johnson",
          client_company: "Tech Innovations Inc.",
          testimonial:
            "CreativeStudio delivered exceptional results that exceeded our expectations. Their attention to detail and creative vision transformed our brand completely.",
          rating: 5,
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          client_name: "Michael Chen",
          client_company: "Digital Solutions",
          testimonial:
            "Working with CreativeStudio was a game-changer for our business. They understood our vision and brought it to life beautifully.",
          rating: 5,
          created_at: new Date().toISOString(),
        },
        {
          id: 3,
          client_name: "Emily Rodriguez",
          client_company: "StartupXYZ",
          testimonial:
            "Professional, creative, and reliable. CreativeStudio helped us establish a strong visual identity that resonates with our target audience.",
          rating: 5,
          created_at: new Date().toISOString(),
        },
        {
          id: 4,
          client_name: "David Thompson",
          client_company: "E-commerce Plus",
          testimonial:
            "The team's expertise in multimedia content creation is unmatched. They delivered high-quality work on time and within budget.",
          rating: 5,
          created_at: new Date().toISOString(),
        },
      ]
    }

    return data || []
  } catch (error) {
    console.error("Database connection error:", error)
    return [
      {
        id: 1,
        client_name: "Sarah Johnson",
        client_company: "Tech Innovations Inc.",
        testimonial:
          "CreativeStudio delivered exceptional results that exceeded our expectations. Their attention to detail and creative vision transformed our brand completely.",
        rating: 5,
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        client_name: "Michael Chen",
        client_company: "Digital Solutions",
        testimonial:
          "Working with CreativeStudio was a game-changer for our business. They understood our vision and brought it to life beautifully.",
        rating: 5,
        created_at: new Date().toISOString(),
      },
    ]
  }
}

export default async function TestimonialsPage() {
  const testimonials = await getTestimonials()

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />

      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-blue-600/10"></div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Client
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                {" "}
                Success Stories
              </span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Discover how we've transformed businesses through exceptional multimedia content and creative solutions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Card className="bg-gradient-to-br from-purple-800/50 to-purple-900/50 border-purple-700/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Heart className="h-8 w-8 text-pink-400" />
                  <span className="text-2xl font-bold text-white">98.5%</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Client Satisfaction</h3>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full"
                    style={{ width: "98.5%" }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-800/50 to-blue-900/50 border-blue-700/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <TrendingUp className="h-8 w-8 text-blue-400" />
                  <span className="text-2xl font-bold text-white">4.9/5</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Average Rating</h3>
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-800/50 to-green-900/50 border-green-700/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Users className="h-8 w-8 text-green-400" />
                  <span className="text-2xl font-bold text-white">500+</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Happy Clients</h3>
                <p className="text-green-400 text-sm">Growing every month</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:from-purple-700 hover:to-blue-700 transition-all">
              All Reviews
            </button>
            <button className="px-6 py-3 bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700 transition-all flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photography
            </button>
            <button className="px-6 py-3 bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700 transition-all flex items-center gap-2">
              <Video className="h-4 w-4" />
              Videography
            </button>
            <button className="px-6 py-3 bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700 transition-all flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Design
            </button>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card
                key={testimonial.id}
                className="relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-gray-700/50 backdrop-blur-sm hover:from-gray-700/80 hover:to-gray-800/80 transition-all duration-300 group"
              >
                <Quote className="absolute top-6 right-6 h-8 w-8 text-purple-400/30 group-hover:text-purple-400/50 transition-colors" />
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-full">
                      {index % 3 === 0 ? "Photography" : index % 3 === 1 ? "Videography" : "Design"}
                    </span>
                  </div>

                  <blockquote className="text-gray-300 leading-relaxed">"{testimonial.testimonial}"</blockquote>

                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                      <span className="font-semibold text-white">{testimonial.client_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">{testimonial.client_name}</p>
                      {testimonial.client_company && (
                        <p className="text-gray-400 text-sm">{testimonial.client_company}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                    <div className="flex items-center space-x-4 text-gray-400">
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="h-4 w-4" />
                        <span className="text-xs">Verified</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">{new Date(testimonial.created_at).toLocaleDateString()}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-gray-800 to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Our Impact in Numbers</h2>
            <p className="text-gray-400">Real results that speak for themselves</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="bg-gradient-to-br from-purple-800/30 to-purple-900/30 border-purple-700/30 text-center">
              <CardContent className="p-8">
                <Award className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <p className="text-4xl font-bold text-white mb-2">500+</p>
                <p className="text-gray-400 mb-4">Happy Clients</p>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                    style={{ width: "95%" }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-800/30 to-blue-900/30 border-blue-700/30 text-center">
              <CardContent className="p-8">
                <TrendingUp className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                <p className="text-4xl font-bold text-white mb-2">98%</p>
                <p className="text-gray-400 mb-4">Satisfaction Rate</p>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full"
                    style={{ width: "98%" }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-800/30 to-green-900/30 border-green-700/30 text-center">
              <CardContent className="p-8">
                <Users className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <p className="text-4xl font-bold text-white mb-2">1,200+</p>
                <p className="text-gray-400 mb-4">Projects Completed</p>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                    style={{ width: "92%" }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-800/30 to-orange-900/30 border-yellow-700/30 text-center">
              <CardContent className="p-8">
                <Star className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                <p className="text-4xl font-bold text-white mb-2">4.9/5</p>
                <p className="text-gray-400 mb-4">Average Rating</p>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full"
                    style={{ width: "98%" }}
                  ></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
