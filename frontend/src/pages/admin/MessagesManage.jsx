import { useState, useEffect } from "react";
import { Trash2, Mail, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MessagesManage = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data);
    } catch (e) {
      toast.error("Failed to fetch messages");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.put(`${API}/admin/messages/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMessages();
    } catch (e) {
      console.error("Failed to mark as read");
    }
  };

  const deleteMessage = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/messages/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Message deleted");
      fetchMessages();
    } catch (e) {
      toast.error("Failed to delete message");
    }
  };

  const openMessage = (message) => {
    setSelectedMessage(message);
    if (!message.read) {
      markAsRead(message.id);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="messages-manage">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">
          Contact Messages
        </h1>
        <div className="text-sm text-muted-foreground">
          {messages.filter((m) => !m.read).length} unread
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No messages yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-soft overflow-hidden">
          <div className="divide-y">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 hover:bg-warm-sand/50 transition-colors cursor-pointer flex items-start justify-between gap-4 ${
                  !message.read ? "bg-primary/5" : ""
                }`}
                onClick={() => openMessage(message)}
                data-testid={`message-${message.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!message.read && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>
                    )}
                    <h3 className={`font-semibold truncate ${!message.read ? "" : "text-foreground/80"}`}>
                      {message.name}
                    </h3>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDate(message.created_at)}
                    </span>
                  </div>
                  <p className="font-medium text-sm mb-1">{message.subject}</p>
                  <p className="text-sm text-muted-foreground truncate">{message.message}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      openMessage(message);
                    }}
                    data-testid={`view-${message.id}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-red-500"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`delete-${message.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Message?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the message from {message.name}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMessage(message.id)}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject}</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selectedMessage.name}</p>
                  <a
                    href={`mailto:${selectedMessage.email}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {selectedMessage.email}
                  </a>
                  {selectedMessage.phone && (
                    <p className="text-sm text-muted-foreground">{selectedMessage.phone}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(selectedMessage.created_at)}
                </p>
              </div>
              <div className="border-t pt-4">
                <p className="text-foreground whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>
              <div className="flex gap-2 pt-4">
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`}
                  className="flex-1"
                >
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white gap-2">
                    <Mail className="w-4 h-4" />
                    Reply via Email
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesManage;
