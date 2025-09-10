"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X, Camera, Video, Palette, User, MessageCircle, Home } from "lucide-react"

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/about", label: "About", icon: User },
    { href: "/services", label: "Services", icon: Camera },
    { href: "/portfolio", label: "Portfolio", icon: Palette },
    { href: "/testimonials", label: "Testimonials", icon: MessageCircle },
    { href: "/contact", label: "Contact", icon: Video },
  ]

  return (
    <nav className="bg-gradient-to-r from-purple-600 via-purple-700 to-blue-600 shadow-lg border-b sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-white to-purple-100 rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300 flex items-center justify-center">
              <Camera className="h-5 w-5 text-purple-600" />
            </div>
            <span className="font-bold text-xl text-white">CreativeStudio</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const IconComponent = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 font-medium transition-all duration-200 group"
                >
                  <IconComponent className="h-4 w-4 group-hover:scale-110 transition-transform" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
            <Button className="ml-4 bg-white text-purple-600 hover:bg-purple-50 shadow-md hover:shadow-lg transition-all duration-200">
              Get Started
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="text-white hover:bg-white/10"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-white/20">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => {
                const IconComponent = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center space-x-3 px-4 py-3 rounded-lg text-white/90 hover:text-white hover:bg-white/10 font-medium transition-all duration-200"
                    onClick={() => setIsOpen(false)}
                  >
                    <IconComponent className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
              <Button className="mx-4 mt-2 bg-white text-purple-600 hover:bg-purple-50 w-fit">Get Started</Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
