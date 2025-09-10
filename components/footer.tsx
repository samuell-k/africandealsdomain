import Link from "next/link"
import { Camera, Video, Palette, Mail, Phone, MapPin } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg"></div>
              <span className="font-bold text-xl">CreativeStudio</span>
            </div>
            <p className="text-gray-400">
              Professional multimedia content creation services for businesses and individuals.
            </p>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Services</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-gray-400">
                <Camera className="h-4 w-4" />
                <span>Photography</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <Video className="h-4 w-4" />
                <span>Videography</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <Palette className="h-4 w-4" />
                <span>Graphic Design</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Quick Links</h3>
            <div className="space-y-2">
              <Link href="/about" className="block text-gray-400 hover:text-white transition-colors">
                About Us
              </Link>
              <Link href="/portfolio" className="block text-gray-400 hover:text-white transition-colors">
                Portfolio
              </Link>
              <Link href="/services" className="block text-gray-400 hover:text-white transition-colors">
                Services
              </Link>
              <Link href="/contact" className="block text-gray-400 hover:text-white transition-colors">
                Contact
              </Link>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Contact</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-gray-400">
                <Mail className="h-4 w-4" />
                <span>hello@creativestudio.com</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <Phone className="h-4 w-4" />
                <span>(555) 123-4567</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-400">
                <MapPin className="h-4 w-4" />
                <span>New York, NY</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; 2025 CreativeStudio. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
