import { useState, useEffect } from "react";
import { Check, X, Trash2, Mail, Phone, Calendar, Edit2, Eye, FileDown, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import axios from "axios";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BookingsManage = () => {
  const [bookings, setBookings] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);
  
  const [editForm, setEditForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    session_type: "",
    package_id: "",
    package_name: "",
    package_price: 0,
    booking_date: "",
    booking_time: "",
    notes: "",
    admin_notes: "",
    status: "",
  });

  useEffect(() => {
    fetchBookings();
    fetchPackages();
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

  const fetchPackages = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.get(`${API}/admin/packages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPackages(res.data);
    } catch (e) {
      console.error("Failed to fetch packages");
    }
  };

  const fetchAvailableTimes = async (date) => {
    try {
      const res = await axios.get(`${API}/bookings/available-times?date=${date}`);
      setAvailableTimes(res.data.available_times || []);
    } catch (e) {
      setAvailableTimes(["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]);
    }
  };

  const updateStatus = async (id, status) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.put(`${API}/admin/bookings/${id}`, { status }, {
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

  const openEditDialog = (booking) => {
    setSelectedBooking(booking);
    setEditForm({
      client_name: booking.client_name,
      client_email: booking.client_email,
      client_phone: booking.client_phone,
      session_type: booking.session_type,
      package_id: booking.package_id,
      package_name: booking.package_name,
      package_price: booking.package_price,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      notes: booking.notes || "",
      admin_notes: booking.admin_notes || "",
      status: booking.status,
    });
    fetchAvailableTimes(booking.booking_date);
    setEditDialogOpen(true);
  };

  const openViewDialog = (booking) => {
    setSelectedBooking(booking);
    setViewDialogOpen(true);
  };

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    
    // If package changes, update price
    if (field === "package_id") {
      const pkg = packages.find((p) => p.id === value);
      if (pkg) {
        setEditForm((prev) => ({
          ...prev,
          package_name: pkg.name,
          package_price: pkg.price,
        }));
      }
    }
    
    // If date changes, fetch available times
    if (field === "booking_date") {
      fetchAvailableTimes(value);
    }
  };

  const handleSaveEdit = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.put(`${API}/admin/bookings/${selectedBooking.id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Booking updated successfully");
      setEditDialogOpen(false);
      fetchBookings();
    } catch (e) {
      toast.error("Failed to update booking");
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
      case "rescheduled":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getFilteredPackages = (sessionType) => {
    return packages.filter((pkg) => pkg.session_type === sessionType);
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
            <SelectItem value="rescheduled">Rescheduled</SelectItem>
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

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Session Type</p>
                      <p className="font-medium capitalize">{booking.session_type?.replace("-", " ")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Package</p>
                      <p className="font-medium">{booking.package_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Price</p>
                      <p className="font-medium text-primary">R{booking.package_price?.toLocaleString()}</p>
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

                  {(booking.notes || booking.admin_notes) && (
                    <div className="mt-3 p-3 bg-warm-sand rounded-lg text-sm">
                      {booking.notes && (
                        <p><span className="text-muted-foreground">Client Notes:</span> {booking.notes}</p>
                      )}
                      {booking.admin_notes && (
                        <p className="mt-1"><span className="text-muted-foreground">Admin Notes:</span> {booking.admin_notes}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap lg:flex-col lg:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openViewDialog(booking)}
                    data-testid={`view-${booking.id}`}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(booking)}
                    data-testid={`edit-${booking.id}`}
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  {booking.status === "pending" && (
                    <Button
                      size="sm"
                      className="bg-green-500 hover:bg-green-600 text-white gap-1"
                      onClick={() => updateStatus(booking.id, "confirmed")}
                      data-testid={`confirm-${booking.id}`}
                    >
                      <Check className="w-4 h-4" />
                      Confirm
                    </Button>
                  )}
                  {booking.status === "confirmed" && (
                    <Button
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={() => updateStatus(booking.id, "completed")}
                      data-testid={`complete-${booking.id}`}
                    >
                      Complete
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

      {/* View Booking Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Client Name</Label>
                  <p className="font-medium">{selectedBooking.client_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p className={`inline-block px-2 py-0.5 rounded text-sm capitalize ${getStatusColor(selectedBooking.status)}`}>
                    {selectedBooking.status}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedBooking.client_email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedBooking.client_phone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Session Type</Label>
                  <p className="font-medium capitalize">{selectedBooking.session_type?.replace("-", " ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Package</Label>
                  <p className="font-medium">{selectedBooking.package_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Price</Label>
                  <p className="font-medium text-primary">R{selectedBooking.package_price?.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date & Time</Label>
                  <p className="font-medium">{selectedBooking.booking_date} at {selectedBooking.booking_time}</p>
                </div>
              </div>
              {selectedBooking.notes && (
                <div>
                  <Label className="text-muted-foreground">Client Notes</Label>
                  <p className="bg-warm-sand p-3 rounded-lg text-sm mt-1">{selectedBooking.notes}</p>
                </div>
              )}
              {selectedBooking.admin_notes && (
                <div>
                  <Label className="text-muted-foreground">Admin Notes</Label>
                  <p className="bg-warm-sand p-3 rounded-lg text-sm mt-1">{selectedBooking.admin_notes}</p>
                </div>
              )}
              
              {/* Contract Section */}
              <div className="pt-4 border-t">
                <Label className="text-muted-foreground flex items-center gap-2">
                  <FileSignature className="w-4 h-4" />
                  Contract
                </Label>
                {selectedBooking.contract_signed ? (
                  <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-800 font-medium flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          Contract Signed
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          Signed on: {selectedBooking.contract_data?.signed_at 
                            ? new Date(selectedBooking.contract_data.signed_at).toLocaleString() 
                            : "N/A"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadContract(selectedBooking.id)}
                        className="gap-2"
                        data-testid="download-contract-btn"
                      >
                        <FileDown className="w-4 h-4" />
                        Download PDF
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-800 text-sm">Contract not signed</p>
                  </div>
                )}
              </div>
              
              <div className="text-xs text-muted-foreground">
                Created: {new Date(selectedBooking.created_at).toLocaleString()}
                {selectedBooking.updated_at && selectedBooking.updated_at !== selectedBooking.created_at && (
                  <> • Updated: {new Date(selectedBooking.updated_at).toLocaleString()}</>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Booking Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Client Name</Label>
                <Input
                  value={editForm.client_name}
                  onChange={(e) => handleEditChange("client_name", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">Status</Label>
                <Select value={editForm.status} onValueChange={(v) => handleEditChange("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="rescheduled">Rescheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Email</Label>
                <Input
                  type="email"
                  value={editForm.client_email}
                  onChange={(e) => handleEditChange("client_email", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">Phone</Label>
                <Input
                  value={editForm.client_phone}
                  onChange={(e) => handleEditChange("client_phone", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Session Type</Label>
                <Select value={editForm.session_type} onValueChange={(v) => handleEditChange("session_type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maternity">Maternity</SelectItem>
                    <SelectItem value="newborn">Newborn</SelectItem>
                    <SelectItem value="studio">Studio Portraits</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="baby-birthday">Baby Birthday</SelectItem>
                    <SelectItem value="adult-birthday">Adult Birthday</SelectItem>
                    <SelectItem value="brand-product">Brand/Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Package</Label>
                <Select value={editForm.package_id} onValueChange={(v) => handleEditChange("package_id", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredPackages(editForm.session_type).map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name} - R{pkg.price.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Date</Label>
                <Input
                  type="date"
                  value={editForm.booking_date}
                  onChange={(e) => handleEditChange("booking_date", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">Time</Label>
                <Select value={editForm.booking_time} onValueChange={(v) => handleEditChange("booking_time", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Include current time even if booked */}
                    {!availableTimes.includes(editForm.booking_time) && (
                      <SelectItem value={editForm.booking_time}>{editForm.booking_time} (Current)</SelectItem>
                    )}
                    {availableTimes.map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Price (ZAR)</Label>
              <Input
                type="number"
                value={editForm.package_price}
                onChange={(e) => handleEditChange("package_price", parseInt(e.target.value) || 0)}
              />
            </div>

            <div>
              <Label className="mb-2 block">Client Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => handleEditChange("notes", e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <Label className="mb-2 block">Admin Notes (Internal)</Label>
              <Textarea
                value={editForm.admin_notes}
                onChange={(e) => handleEditChange("admin_notes", e.target.value)}
                placeholder="Internal notes, not visible to client"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSaveEdit}
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingsManage;
