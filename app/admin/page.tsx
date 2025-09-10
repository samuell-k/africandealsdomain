import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LogOut, Users, Camera, MessageSquare, Star } from "lucide-react"
import { signOut } from "@/lib/actions"
import Link from "next/link"

async function getDashboardStats() {
  if (!isSupabaseConfigured) return null

  const supabase = createClient()

  const [portfolioResult, servicesResult, testimonialsResult, messagesResult] = await Promise.all([
    supabase.from("portfolio_items").select("id", { count: "exact" }),
    supabase.from("services").select("id", { count: "exact" }),
    supabase.from("testimonials").select("id", { count: "exact" }),
    supabase.from("contact_messages").select("id", { count: "exact" }),
  ])

  return {
    portfolio: portfolioResult.count || 0,
    services: servicesResult.count || 0,
    testimonials: testimonialsResult.count || 0,
    messages: messagesResult.count || 0,
  }
}

export default async function AdminDashboard() {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Connect Supabase to get started</h1>
      </div>
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/admin/login")
  }

  const stats = await getDashboardStats()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg"></div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user.email}</span>
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Portfolio Items</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.portfolio || 0}</p>
                </div>
                <Camera className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Services</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.services || 0}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Testimonials</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.testimonials || 0}</p>
                </div>
                <Star className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Messages</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.messages || 0}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/admin/portfolio">
                <Button className="w-full bg-purple-600 hover:bg-purple-700">Manage Portfolio</Button>
              </Link>
              <Link href="/admin/services">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">Manage Services</Button>
              </Link>
              <Link href="/admin/testimonials">
                <Button className="w-full bg-yellow-600 hover:bg-yellow-700">Manage Testimonials</Button>
              </Link>
              <Link href="/admin/messages">
                <Button className="w-full bg-green-600 hover:bg-green-700">View Messages</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Website Link */}
        <div className="mt-8 text-center">
          <Link href="/" target="_blank">
            <Button variant="outline" size="lg">
              View Public Website
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
