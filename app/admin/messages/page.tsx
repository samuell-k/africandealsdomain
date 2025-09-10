"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Mail, Phone, Calendar, Eye, Trash2 } from "lucide-react"
import Link from "next/link"

interface ContactMessage {
  id: string
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
  status: string
  created_at: string
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    fetchMessages()
  }, [])

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error("Error fetching messages:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateMessageStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id)
      if (error) throw error
      await fetchMessages()
    } catch (error) {
      console.error("Error updating message status:", error)
    }
  }

  const deleteMessage = async (id: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return

    try {
      const { error } = await supabase.from("contact_messages").delete().eq("id", id)
      if (error) throw error
      await fetchMessages()
    } catch (error) {
      console.error("Error deleting message:", error)
    }
  }

  const openMessageDialog = async (message: ContactMessage) => {
    setSelectedMessage(message)
    setIsDialogOpen(true)

    // Mark as read if it's unread
    if (message.status === "unread") {
      await updateMessageStatus(message.id, "read")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "unread":
        return "bg-red-100 text-red-800"
      case "read":
        return "bg-blue-100 text-blue-800"
      case "replied":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Contact Messages</h1>
            </div>
            <div className="text-sm text-gray-600">{messages.length} total messages</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          {messages.map((message) => (
            <Card
              key={message.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${message.status === "unread" ? "border-l-4 border-l-red-500" : ""}`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-4">
                      <h3 className="font-semibold text-lg">{message.name}</h3>
                      <Badge className={getStatusColor(message.status)}>{message.status}</Badge>
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(message.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-1" />
                        {message.email}
                      </div>
                      {message.phone && (
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-1" />
                          {message.phone}
                        </div>
                      )}
                    </div>
                    {message.subject && <p className="font-medium text-gray-900">Subject: {message.subject}</p>}
                    <p className="text-gray-700 line-clamp-2">{message.message}</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button size="sm" variant="outline" onClick={() => openMessageDialog(message)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteMessage(message.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No messages yet.</p>
          </div>
        )}

        {/* Message Detail Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Message Details</DialogTitle>
            </DialogHeader>
            {selectedMessage && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Name</label>
                    <p className="text-gray-900">{selectedMessage.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p className="text-gray-900">{selectedMessage.email}</p>
                  </div>
                  {selectedMessage.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Phone</label>
                      <p className="text-gray-900">{selectedMessage.phone}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-600">Date</label>
                    <p className="text-gray-900">{formatDate(selectedMessage.created_at)}</p>
                  </div>
                </div>
                {selectedMessage.subject && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Subject</label>
                    <p className="text-gray-900">{selectedMessage.subject}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-600">Message</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.message}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <div className="space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateMessageStatus(selectedMessage.id, "read")}
                      disabled={selectedMessage.status === "read"}
                    >
                      Mark as Read
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateMessageStatus(selectedMessage.id, "replied")}
                      disabled={selectedMessage.status === "replied"}
                    >
                      Mark as Replied
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.location.href = `mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject || "Your inquiry"}`
                    }}
                  >
                    Reply via Email
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
