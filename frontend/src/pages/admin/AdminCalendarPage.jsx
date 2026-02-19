import { useState, useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { X, User, Mail, Phone, Calendar, Clock, Package, DollarSign, Send, Trash2, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { format, addMonths, subMonths } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminCalendarPage = () => {
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showManualBookingModal, setShowManualBookingModal] = useState(false);
  const [bookingLink, setBookingLink] = useState(null);
  
  const [manualBookingData, setManualBookingData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    session_type: "maternity",
    booking_date: "",
    booking_time: "",
    notes: ""
  });

  const sessionTypes = [
    { value: "maternity", label: "Maternity" },
    { value: "newborn", label: "Newborn" },
    { value: "baby", label: "Baby (Sitter/Cake Smash)" },
    { value: "family", label: "Family" },
    { value: "couples", label: "Couples" },
    { value: "individual", label: "Individual" },
    { value: "boudoir", label: "Boudoir" },
    { value: "brand", label: "Brand/Product" },
  ];

  useEffect(() => {
    fetchCalendarEvents(new Date());
  }, []);

  const fetchCalendarEvents = async (date) => {
    const token = localStorage.getItem("admin_token");
    setLoading(true);
    
    const startDate = format(subMonths(date, 1), "yyyy-MM-dd");
    const endDate = format(addMonths(date, 2), "yyyy-MM-dd");
    
    try {
      const res = await axios.get(`${API}/admin/calendar-view`, {
        params: { start_date: startDate, end_date: endDate },
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(res.data.events);
    } catch (e) {
      toast.error("Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (info) => {
    // Clicked on a date cell (empty area)
    const clickedDate = info.dateStr;
    const time = info.date.getHours();
    
    setSelectedSlot({
      date: clickedDate.split("T")[0],
      time: time >= 12 ? `${time}:00` : `${time.toString().padStart(2, "0")}:00`,
      dateTime: info.dateStr
    });
    setShowSlotModal(true);
  };

  const handleEventClick = (info) => {
    const event = info.event;
    const props = event.extendedProps;
    
    // Handle open slot clicks - open the slot action modal
    if (props.type === "open") {
      setSelectedSlot({
        date: props.date,
        time: props.time,
        dateTime: `${props.date}T${props.time}`
      });
      setShowSlotModal(true);
      return;
    }
    
    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      type: props.type,
      ...props
    });
    setShowEventModal(true);
  };

  const handleDatesSet = (dateInfo) => {
    // Fetch events when calendar view changes
    fetchCalendarEvents(dateInfo.start);
  };

  const handleBlockSlot = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.post(`${API}/admin/blocked-slots`, {
        date: selectedSlot.date,
        time: selectedSlot.time,
        reason: "Blocked by admin"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Time slot blocked");
      setShowSlotModal(false);
      fetchCalendarEvents(new Date());
    } catch (e) {
      toast.error("Failed to block slot");
    }
  };

  const handleUnblockSlot = async (slotId) => {
    const token = localStorage.getItem("admin_token");
    try {
      await axios.delete(`${API}/admin/blocked-slots/${slotId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Time slot unblocked");
      setShowEventModal(false);
      fetchCalendarEvents(new Date());
    } catch (e) {
      toast.error("Failed to unblock slot");
    }
  };

  const handleOpenManualBooking = () => {
    setManualBookingData({
      ...manualBookingData,
      booking_date: selectedSlot.date,
      booking_time: selectedSlot.time
    });
    setShowSlotModal(false);
    setShowManualBookingModal(true);
  };

  const handleCreateManualBooking = async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await axios.post(`${API}/admin/manual-booking`, manualBookingData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setBookingLink(res.data.booking_link);
      toast.success("Manual booking created! Link sent to client.");
      fetchCalendarEvents(new Date());
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create booking");
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    const token = localStorage.getItem("admin_token");
    if (!confirm("Are you sure you want to delete this booking?")) return;
    
    try {
      await axios.delete(`${API}/admin/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Booking deleted");
      setShowEventModal(false);
      fetchCalendarEvents(new Date());
    } catch (e) {
      toast.error("Failed to delete booking");
    }
  };

  const getEventClassNames = (eventInfo) => {
    const type = eventInfo.event.extendedProps?.type;
    return [`calendar-event-${type || 'default'}`];
  };

  return (
    <div className="p-6" data-testid="admin-calendar-page">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Calendar</h1>
          <p className="text-muted-foreground">Manage bookings, view personal events, and block time slots</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
              <span>Confirmed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#F59E0B]"></div>
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#8B5CF6]"></div>
              <span>Awaiting Client</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#64748B]"></div>
              <span>Personal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#EF4444]"></div>
              <span>Blocked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-soft p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay"
          }}
          events={events}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
          eventClassNames={getEventClassNames}
          slotMinTime="07:00:00"
          slotMaxTime="19:00:00"
          allDaySlot={true}
          weekends={true}
          nowIndicator={true}
          slotDuration="01:00:00"
          height="auto"
          expandRows={true}
          stickyHeaderDates={true}
          dayMaxEvents={3}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            meridiem: "short"
          }}
        />
      </div>

      {/* Event Details Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent?.type === "booking" && "Booking Details"}
              {selectedEvent?.type === "personal" && "Personal Event"}
              {selectedEvent?.type === "blocked" && "Blocked Slot"}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              {selectedEvent.type === "booking" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedEvent.clientName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">{selectedEvent.clientEmail}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedEvent.clientPhone || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedEvent.sessionType}</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-warm-sand rounded-lg">
                    <p className="font-medium">{selectedEvent.packageName}</p>
                    <p className="text-primary font-semibold">R{selectedEvent.totalPrice?.toLocaleString()}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedEvent.status === "confirmed" ? "bg-green-100 text-green-700" :
                      selectedEvent.status === "pending" ? "bg-amber-100 text-amber-700" :
                      selectedEvent.status === "awaiting_client" ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {selectedEvent.status?.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  
                  <DialogFooter className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/admin/bookings?id=${selectedEvent.bookingId}`, "_blank")}
                    >
                      View Details
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteBooking(selectedEvent.bookingId)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </DialogFooter>
                </>
              )}
              
              {selectedEvent.type === "personal" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="w-4 h-4" />
                    <span>Personal calendar event (read-only)</span>
                  </div>
                  <p className="font-medium">{selectedEvent.summary}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEvent.start && format(new Date(selectedEvent.start), "PPp")}
                  </p>
                  <p className="text-sm bg-amber-50 text-amber-700 p-2 rounded">
                    This event blocks availability from your Apple Calendar
                  </p>
                </div>
              )}
              
              {selectedEvent.type === "blocked" && (
                <div className="space-y-3">
                  <p className="font-medium">{selectedEvent.reason}</p>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => handleUnblockSlot(selectedEvent.slotId)}
                    >
                      Unblock This Slot
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Slot Action Modal */}
      <Dialog open={showSlotModal} onOpenChange={setShowSlotModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Time Slot Actions</DialogTitle>
          </DialogHeader>
          
          {selectedSlot && (
            <div className="space-y-4">
              <p className="text-center text-lg font-medium">
                {selectedSlot.date} at {selectedSlot.time}
              </p>
              
              <div className="grid gap-3">
                <Button onClick={handleOpenManualBooking} className="w-full gap-2">
                  <Plus className="w-4 h-4" />
                  Create Manual Booking
                </Button>
                <Button variant="outline" onClick={handleBlockSlot} className="w-full gap-2">
                  <Lock className="w-4 h-4" />
                  Block This Slot
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Booking Modal */}
      <Dialog open={showManualBookingModal} onOpenChange={(open) => {
        setShowManualBookingModal(open);
        if (!open) setBookingLink(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Manual Booking</DialogTitle>
          </DialogHeader>
          
          {!bookingLink ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client Name *</Label>
                  <Input
                    value={manualBookingData.client_name}
                    onChange={(e) => setManualBookingData({...manualBookingData, client_name: e.target.value})}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <Label>Client Email *</Label>
                  <Input
                    type="email"
                    value={manualBookingData.client_email}
                    onChange={(e) => setManualBookingData({...manualBookingData, client_email: e.target.value})}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone (Optional)</Label>
                  <Input
                    value={manualBookingData.client_phone}
                    onChange={(e) => setManualBookingData({...manualBookingData, client_phone: e.target.value})}
                    placeholder="+27..."
                  />
                </div>
                <div>
                  <Label>Session Type *</Label>
                  <Select
                    value={manualBookingData.session_type}
                    onValueChange={(v) => setManualBookingData({...manualBookingData, session_type: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sessionTypes.map((st) => (
                        <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={manualBookingData.booking_date}
                    onChange={(e) => setManualBookingData({...manualBookingData, booking_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={manualBookingData.booking_time}
                    onChange={(e) => setManualBookingData({...manualBookingData, booking_time: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={manualBookingData.notes}
                  onChange={(e) => setManualBookingData({...manualBookingData, notes: e.target.value})}
                  placeholder="Any notes about the booking..."
                  rows={2}
                />
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowManualBookingModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateManualBooking}
                  disabled={!manualBookingData.client_name || !manualBookingData.client_email}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Booking Link
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Send className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">Booking Link Sent!</h3>
              <p className="text-muted-foreground">
                An email has been sent to <strong>{manualBookingData.client_email}</strong> with a link to complete their booking.
              </p>
              <div className="bg-warm-sand p-3 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Direct link:</p>
                <code className="text-xs break-all">{window.location.origin}{bookingLink}</code>
              </div>
              <Button onClick={() => {
                setShowManualBookingModal(false);
                setBookingLink(null);
              }}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom styles for FullCalendar */}
      <style>{`
        .fc {
          --fc-border-color: #e5e7eb;
          --fc-button-bg-color: #C6A87C;
          --fc-button-border-color: #C6A87C;
          --fc-button-hover-bg-color: #b5976b;
          --fc-button-hover-border-color: #b5976b;
          --fc-button-active-bg-color: #a4865a;
          --fc-today-bg-color: #fef3e2;
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: var(--fc-border-color);
        }
        .fc-event {
          cursor: pointer;
          border-radius: 4px;
          font-size: 0.75rem;
          padding: 2px 4px;
        }
        .fc-timegrid-slot {
          height: 3rem !important;
        }
        .fc-timegrid-slot-label {
          font-size: 0.75rem;
        }
        .fc-col-header-cell-cushion {
          font-weight: 600;
        }
        .fc-daygrid-day-number {
          font-weight: 500;
        }
        .fc-toolbar-title {
          font-family: 'Playfair Display', serif !important;
          font-size: 1.5rem !important;
        }
      `}</style>
    </div>
  );
};

export default AdminCalendarPage;
