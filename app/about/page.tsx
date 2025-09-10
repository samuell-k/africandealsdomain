import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Camera, Award, Users, Clock } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function AboutPage() {
  const stats = [
    { icon: Users, label: "Happy Clients", value: "500+" },
    { icon: Camera, label: "Projects Completed", value: "1,200+" },
    { icon: Award, label: "Awards Won", value: "25+" },
    { icon: Clock, label: "Years Experience", value: "8+" },
  ]

  const team = [
    {
      name: "Alex Johnson",
      role: "Lead Photographer",
      bio: "Specializing in wedding and portrait photography with over 10 years of experience.",
      image:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Battle%20of%20the%20brands%21%20We%20break%20down%20the%20pros%20and%E2%80%A6-Z3llZBagItsXwqfUoEPJQ21QkmfAQv.jpeg", // Using Canon camera image for photographer
    },
    {
      name: "Sarah Chen",
      role: "Video Director",
      bio: "Award-winning videographer creating compelling brand stories and documentaries.",
      image:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg", // Using video editing workspace for video director
    },
    {
      name: "Mike Rodriguez",
      role: "Graphic Designer",
      bio: "Creative designer crafting memorable brand identities and visual experiences.",
      image:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unlock%20the%20power%20of%20stunning%20visuals%20with%20our%E2%80%A6-KCP9LosdezkL6slKvDC3Hb88AqngqZ.jpeg", // Using graphic design poster for designer
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl font-bold text-gray-900 leading-tight">
                About
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                  {" "}
                  CreativeStudio
                </span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                We are a passionate team of multimedia professionals dedicated to bringing your creative vision to life
                through stunning photography, videography, and graphic design.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/contact">
                  <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                    Work With Us
                  </Button>
                </Link>
                <Link href="/portfolio">
                  <Button size="lg" variant="outline">
                    View Our Work
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg" // Using video editing workspace image for hero
                alt="Creative team at work"
                width={400} // Made smaller from 600
                height={300} // Made smaller from 500
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <stat.icon className="h-8 w-8 text-purple-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-gray-600">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-8">
            <h2 className="text-4xl font-bold text-gray-900">Our Story</h2>
            <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
              <p>
                Founded in 2016, CreativeStudio began as a small photography business with a big dream: to help
                individuals and businesses tell their stories through compelling visual content.
              </p>
              <p>
                Over the years, we've expanded our services to include videography and graphic design, building a
                reputation for creativity, professionalism, and exceptional client service. Our work has been featured
                in numerous publications and has helped our clients achieve their marketing and personal goals.
              </p>
              <p>
                Today, we're proud to be a full-service multimedia studio, working with clients ranging from small
                startups to Fortune 500 companies, always with the same commitment to excellence that started it all.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-gray-900">Meet Our Team</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Talented professionals passionate about creating exceptional visual content
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <Card key={index} className="text-center overflow-hidden">
                <div className="relative h-48">
                  {" "}
                  {/* Made smaller from aspect-square */}
                  <Image
                    src={member.image || "/placeholder.svg"}
                    alt={member.name}
                    width={300} // Added specific width
                    height={200} // Added specific height
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{member.name}</h3>
                    <p className="text-purple-600 font-medium">{member.role}</p>
                  </div>
                  <p className="text-gray-600">{member.bio}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
