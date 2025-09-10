"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X, Camera, Video, Palette, User, MessageCircle, Home, Sparkles } from "lucide-react"

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
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-gradient-to-r from-slate-900/95 via-purple-900/95 to-slate-900/95 border-b border-purple-500/20 shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-purple-600/10"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl shadow-lg group-hover:shadow-purple-500/25 transition-all duration-300 flex items-center justify-center group-hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"></div>
              <Camera className="h-6 w-6 text-white relative z-10" />
              <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-yellow-400 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl text-white group-hover:text-purple-200 transition-colors">
                CreativeStudio
              </span>
              <span className="text-xs text-purple-300 font-medium">Multimedia Excellence</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => {
              const IconComponent = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex items-center space-x-2 px-4 py-2 rounded-xl text-white/90 hover:text-white font-medium transition-all duration-300 group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/20 to-blue-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <IconComponent className="h-4 w-4 group-hover:scale-110 transition-transform relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                  <div className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 group-hover:w-full group-hover:left-0 transition-all duration-300"></div>
                </Link>
              )
            })}
            <Button className="ml-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg hover:shadow-purple-500/25 transition-all duration-300 px-6 py-2 rounded-xl font-semibold">
              <Sparkles className="h-4 w-4 mr-2" />
              Get Started
            </Button>
          </div>

          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="text-white hover:bg-white/10 rounded-xl transition-all duration-300"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 border-t border-purple-500/20">
            <div className="flex flex-col space-y-1">
              {navItems.map((item) => {
                const IconComponent = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center space-x-3 px-4 py-3 rounded-xl text-white/90 hover:text-white hover:bg-white/10 font-medium transition-all duration-300 group"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center group-hover:from-purple-500/30 group-hover:to-blue-500/30 transition-all duration-300">
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
              <Button className="mx-4 mt-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg rounded-xl font-semibold">
                <Sparkles className="h-4 w-4 mr-2" />
                Get Started
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
