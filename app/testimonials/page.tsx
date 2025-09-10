import { supabase } from "@/lib/supabase/client"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Star, Quote } from "lucide-react"

async function getTestimonials() {
  try {
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
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Client
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
              {" "}
              Testimonials
            </span>
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            Hear what our clients have to say about working with CreativeStudio
          </p>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.id} className="relative p-8 hover:shadow-lg transition-shadow">
                <Quote className="absolute top-6 right-6 h-8 w-8 text-purple-200" />
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <blockquote className="text-lg text-gray-700 italic leading-relaxed">
                    "{testimonial.testimonial}"
                  </blockquote>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center">
                      <span className="font-semibold text-purple-600">{testimonial.client_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{testimonial.client_name}</p>
                      {testimonial.client_company && <p className="text-gray-600">{testimonial.client_company}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
              <p className="text-4xl font-bold text-purple-600">500+</p>
              <p className="text-gray-600">Happy Clients</p>
            </div>
            <div className="space-y-2">
              <p className="text-4xl font-bold text-purple-600">98%</p>
              <p className="text-gray-600">Satisfaction Rate</p>
            </div>
            <div className="space-y-2">
              <p className="text-4xl font-bold text-purple-600">1,200+</p>
              <p className="text-gray-600">Projects Completed</p>
            </div>
            <div className="space-y-2">
              <p className="text-4xl font-bold text-purple-600">4.9/5</p>
              <p className="text-gray-600">Average Rating</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
