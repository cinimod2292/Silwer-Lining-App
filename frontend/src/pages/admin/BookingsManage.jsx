import { useState, useEffect } from "react";
import { Check, X, Trash2, Mail, Phone, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BookingsManage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(res.data);
    } catch (e) {
      toast.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.put(`${API}/admin/bookings/${id}?status=${status}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Booking updated");
      fetchBookings();
    } catch (e) {
      toast.error("Failed to update booking");
    }
  };

  const deleteBooking = async (id) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/bookings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Booking deleted");
      fetchBookings();
    } catch (e) {
      toast.error("Failed to delete booking");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "completed":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const filteredBookings = filter === "all"
    ? bookings
    : bookings.filter((b) => b.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="bookings-manage">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">
          Manage Bookings
        </h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]" data-testid="filter-select">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookings</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-soft p-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {filter === "all" ? "No bookings yet." : `No ${filter} bookings.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-xl shadow-soft p-6"
              data-testid={`booking-${booking.id}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{booking.client_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {booking.client_email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {booking.client_phone}
                        </span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Session Type</p>
                      <p className="font-medium capitalize">{booking.session_type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Package</p>
                      <p className="font-medium">{booking.package_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date</p>
                      <p className="font-medium">{booking.booking_date}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Time</p>
                      <p className="font-medium">{booking.booking_time}</p>
                    </div>
                  </div>

                  {booking.notes && (
                    <div className="mt-3 p-3 bg-warm-sand rounded-lg text-sm">
                      <p className="text-muted-foreground">Notes:</p>
                      <p>{booking.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 lg:flex-col lg:w-auto">
                  {booking.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white gap-1"
                        onClick={() => updateStatus(booking.id, "confirmed")}
                        data-testid={`confirm-${booking.id}`}
                      >
                        <Check className="w-4 h-4" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 border-red-500 hover:bg-red-50 gap-1"
                        onClick={() => updateStatus(booking.id, "cancelled")}
                        data-testid={`cancel-${booking.id}`}
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </Button>
                    </>
                  )}
                  {booking.status === "confirmed" && (
                    <Button
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={() => updateStatus(booking.id, "completed")}
                      data-testid={`complete-${booking.id}`}
                    >
                      Mark Complete
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-red-500"
                        data-testid={`delete-${booking.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the booking for {booking.client_name}.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteBooking(booking.id)}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingsManage;
