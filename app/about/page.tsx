import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Camera, Award, Users, Clock, Target, Heart, Shield, Lightbulb } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function AboutPage() {
  const stats = [
    { icon: Users, label: "Happy Clients", value: "500+", color: "from-blue-500 to-cyan-500" },
    { icon: Camera, label: "Projects Completed", value: "1,200+", color: "from-purple-500 to-pink-500" },
    { icon: Award, label: "Awards Won", value: "25+", color: "from-orange-500 to-red-500" },
    { icon: Clock, label: "Years Experience", value: "8+", color: "from-green-500 to-emerald-500" },
  ]

  const skills = [
    { name: "Photography", level: 95, color: "bg-blue-500" },
    { name: "Videography", level: 90, color: "bg-purple-500" },
    { name: "Graphic Design", level: 88, color: "bg-pink-500" },
    { name: "Brand Strategy", level: 85, color: "bg-orange-500" },
  ]

  const values = [
    { icon: Heart, title: "Passion", description: "We love what we do and it shows in every project" },
    { icon: Shield, title: "Quality", description: "Excellence is our standard, not our goal" },
    { icon: Lightbulb, title: "Innovation", description: "Always pushing creative boundaries" },
    { icon: Target, title: "Results", description: "Focused on delivering measurable success" },
  ]

  const journey = [
    { year: "2016", title: "Studio Founded", description: "Started as a small photography business" },
    { year: "2018", title: "Video Services", description: "Expanded into professional videography" },
    { year: "2020", title: "Design Team", description: "Added graphic design and branding" },
    { year: "2024", title: "Industry Leader", description: "Recognized as top multimedia studio" },
  ]

  const team = [
    {
      name: "Alex Johnson",
      role: "Lead Photographer",
      bio: "Specializing in wedding and portrait photography with over 10 years of experience.",
      image:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Battle%20of%20the%20brands%21%20We%20break%20down%20the%20pros%20and%E2%80%A6-Z3llZBagItsXwqfUoEPJQ21QkmfAQv.jpeg",
      expertise: ["Portrait", "Wedding", "Commercial"],
    },
    {
      name: "Sarah Chen",
      role: "Video Director",
      bio: "Award-winning videographer creating compelling brand stories and documentaries.",
      image:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg",
      expertise: ["Corporate", "Documentary", "Social Media"],
    },
    {
      name: "Mike Rodriguez",
      role: "Graphic Designer",
      bio: "Creative designer crafting memorable brand identities and visual experiences.",
      image:
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unlock%20the%20power%20of%20stunning%20visuals%20with%20our%E2%80%A6-KCP9LosdezkL6slKvDC3Hb88AqngqZ.jpeg",
      expertise: ["Branding", "Web Design", "Print"],
    },
  ]

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />

      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/20 to-blue-900/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl font-bold text-white leading-tight">
                About
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                  {" "}
                  CreativeStudio
                </span>
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed">
                We are a passionate team of multimedia professionals dedicated to bringing your creative vision to life
                through stunning photography, videography, and graphic design.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/contact">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  >
                    Work With Us
                  </Button>
                </Link>
                <Link href="/portfolio">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white bg-transparent"
                  >
                    View Our Work
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fc069051-d25a-46b4-b61c-48a61669cdd0-3uHD0WZHnWDacvWjrb98ArXsbCw9SG.jpeg"
                  alt="Creative team at work"
                  width={400}
                  height={300}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-all duration-300">
                <CardContent className="p-6 text-center space-y-4">
                  <div
                    className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-full flex items-center justify-center mx-auto`}
                  >
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-gray-400 text-sm">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-white">Our Expertise</h2>
            <p className="text-gray-400">Mastering the art of visual storytelling</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {skills.map((skill, index) => (
              <Card key={index} className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-white font-medium">{skill.name}</span>
                    <span className="text-gray-400">{skill.level}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`${skill.color} h-2 rounded-full transition-all duration-1000`}
                      style={{ width: `${skill.level}%` }}
                    ></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-white">Our Values</h2>
            <p className="text-gray-400">What drives us every day</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <Card key={index} className="bg-gray-900 border-gray-700 hover:bg-gray-800 transition-all duration-300">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto">
                    <value.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{value.title}</h3>
                  <p className="text-gray-400 text-sm">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-white">Our Journey</h2>
            <p className="text-gray-400">Growing stronger every year</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {journey.map((milestone, index) => (
              <Card key={index} className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-all duration-300">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="text-2xl font-bold text-purple-400">{milestone.year}</div>
                  <h3 className="text-lg font-semibold text-white">{milestone.title}</h3>
                  <p className="text-gray-400 text-sm">{milestone.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-white">Meet Our Team</h2>
            <p className="text-gray-400">Talented professionals passionate about creating exceptional visual content</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <Card
                key={index}
                className="bg-gray-900 border-gray-700 overflow-hidden hover:bg-gray-800 transition-all duration-300"
              >
                <div className="relative h-48">
                  <Image
                    src={member.image || "/placeholder.svg"}
                    alt={member.name}
                    width={300}
                    height={200}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{member.name}</h3>
                    <p className="text-purple-400 font-medium">{member.role}</p>
                  </div>
                  <p className="text-gray-400 text-sm">{member.bio}</p>
                  <div className="flex flex-wrap gap-2">
                    {member.expertise.map((skill, skillIndex) => (
                      <span
                        key={skillIndex}
                        className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
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
